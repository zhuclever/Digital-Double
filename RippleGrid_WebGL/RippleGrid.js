// Codex edit (2025-10-02): Refactored RippleGrid into a vanilla JS helper and added curvature/interaction controls.
import { Renderer, Program, Triangle, Mesh } from './node_modules/ogl/src/index.js';

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const defaultOptions = {
    enableRainbow: false,
    gridColor: '#ffffff',
    rippleIntensity: 0.06,
    gridSize: 10.0,
    gridThickness: 15.0,
    fadeDistance: 1.5,
    vignetteStrength: 2.0,
    glowIntensity: 0.1,
    opacity: 1.0,
    gridRotation: 0,
    mouseInteraction: true,
    mouseInteractionRadius: 1.0,
    autoRippleStrength: 1.0,
    autoRippleSpeed: 1.0,
    mouseRippleStrength: 0.3,
    curvatureAmount: 0.0,
    timeMultiplier: 1.0,
    maxDpr: 2,
    mouseLerp: 0.1,
    influenceLerp: 0.08
};

const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? [
            parseInt(result[1], 16) / 255,
            parseInt(result[2], 16) / 255,
            parseInt(result[3], 16) / 255
        ]
        : [1, 1, 1];
};

const vert = `
attribute vec2 position;
varying vec2 vUv;
void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
}`;

const frag = `precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform bool enableRainbow;
uniform vec3 gridColor;
uniform float rippleIntensity;
uniform float gridSize;
uniform float gridThickness;
uniform float fadeDistance;
uniform float vignetteStrength;
uniform float glowIntensity;
uniform float opacity;
uniform float gridRotation;
uniform bool mouseInteraction;
uniform vec2 mousePosition;
uniform float mouseInfluence;
uniform float mouseInteractionRadius;
uniform float autoRippleStrength;
uniform float autoRippleSpeed;
uniform float mouseRippleStrength;
uniform float curvatureAmount;
varying vec2 vUv;

const float pi = 3.141592653589793;

mat2 rotate(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

// Push coordinates radially away from center for a balanced bow effect
vec2 applyCurvature(vec2 coord, float curvature) {
    if (curvature == 0.0) {
        return coord;
    }
    float radial = length(coord);
    if (radial == 0.0) {
        return coord;
    }
    vec2 direction = coord / radial;
    float intensity = curvature * radial * radial;
    return coord + direction * intensity;
}

void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    if (gridRotation != 0.0) {
        uv = rotate(gridRotation * pi / 180.0) * uv;
    }

    vec2 curvedUv = applyCurvature(uv, curvatureAmount);
    float dist = length(curvedUv);

    float baseWave = sin(pi * ((iTime * autoRippleSpeed) - dist));
    vec2 rippleUv = curvedUv + curvedUv * baseWave * rippleIntensity * autoRippleStrength;

    if (mouseInteraction && mouseInfluence > 0.001) {
        vec2 mouseUv = (mousePosition * 2.0 - 1.0);
        mouseUv.x *= iResolution.x / iResolution.y;
        mouseUv = applyCurvature(mouseUv, curvatureAmount);

        vec2 diff = rippleUv - mouseUv;
        float mouseDist = length(diff);
        float radius = max(0.0001, mouseInteractionRadius);
        float falloff = exp(-(mouseDist * mouseDist) / (radius * radius));
        float influence = mouseInfluence * falloff;

        if (mouseDist > 0.0001) {
            vec2 dir = diff / mouseDist;
            float mouseWave = sin(pi * ((iTime * 2.0) - mouseDist * 3.0));
            rippleUv += dir * mouseWave * rippleIntensity * mouseRippleStrength * influence;
        }
    }

    vec2 a = sin(gridSize * 0.5 * pi * rippleUv - pi / 2.0);
    vec2 b = abs(a);

    float aaWidth = 0.5;
    vec2 smoothB = vec2(
        smoothstep(0.0, aaWidth, b.x),
        smoothstep(0.0, aaWidth, b.y)
    );

    vec3 color = vec3(0.0);
    color += exp(-gridThickness * smoothB.x * (0.8 + 0.5 * sin(pi * iTime)));
    color += exp(-gridThickness * smoothB.y);
    color += 0.5 * exp(-(gridThickness / 4.0) * sin(smoothB.x));
    color += 0.5 * exp(-(gridThickness / 3.0) * smoothB.y);

    if (glowIntensity > 0.0) {
        color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.x);
        color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.y);
    }

    float ddd = exp(-2.0 * clamp(pow(dist, fadeDistance), 0.0, 1.0));

    vec2 vignetteCoords = vUv - 0.5;
    float vignetteDistance = length(vignetteCoords);
    float vignette = 1.0 - pow(vignetteDistance * 2.0, vignetteStrength);
    vignette = clamp(vignette, 0.0, 1.0);

    vec3 t;
    if (enableRainbow) {
        t = vec3(
            curvedUv.x * 0.5 + 0.5 * sin(iTime),
            curvedUv.y * 0.5 + 0.5 * cos(iTime),
            pow(cos(iTime), 4.0)
        ) + 0.5;
    } else {
        t = gridColor;
    }

    float finalFade = ddd * vignette;
    float alpha = length(color) * finalFade * opacity;
    gl_FragColor = vec4(color * t * finalFade * opacity, alpha);
}`;

export function createRippleGrid({ container, options = {} } = {}) {
    if (!container) {
        throw new Error('createRippleGrid: container element is required');
    }

    const state = {
        options: { ...defaultOptions, ...options },
        mouseTarget: { x: 0.5, y: 0.5 },
        mouseCurrent: { x: 0.5, y: 0.5 },
        influenceValue: 0,
        influenceTarget: 0,
        renderer: null,
        mesh: null,
        uniforms: null,
        resizeObserver: null,
        rafId: null,
        destroyed: false,
        listenersAttached: false
    };

    const renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio || 1, state.options.maxDpr),
        alpha: true
    });
    state.renderer = renderer;

    const { gl } = renderer;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    container.appendChild(gl.canvas);

    const uniforms = {
        iTime: { value: 0 },
        iResolution: { value: [1, 1] },
        enableRainbow: { value: state.options.enableRainbow },
        gridColor: { value: hexToRgb(state.options.gridColor) },
        rippleIntensity: { value: state.options.rippleIntensity },
        gridSize: { value: state.options.gridSize },
        gridThickness: { value: state.options.gridThickness },
        fadeDistance: { value: state.options.fadeDistance },
        vignetteStrength: { value: state.options.vignetteStrength },
        glowIntensity: { value: state.options.glowIntensity },
        opacity: { value: state.options.opacity },
        gridRotation: { value: state.options.gridRotation },
        mouseInteraction: { value: state.options.mouseInteraction },
        mousePosition: { value: [0.5, 0.5] },
        mouseInfluence: { value: 0 },
        mouseInteractionRadius: { value: state.options.mouseInteractionRadius },
        autoRippleStrength: { value: state.options.autoRippleStrength },
        autoRippleSpeed: { value: state.options.autoRippleSpeed },
        mouseRippleStrength: { value: state.options.mouseRippleStrength },
        curvatureAmount: { value: state.options.curvatureAmount }
    };

    state.uniforms = uniforms;

    const geometry = new Triangle(gl);
    const program = new Program(gl, { vertex: vert, fragment: frag, uniforms });
    const mesh = new Mesh(gl, { geometry, program });
    state.mesh = mesh;

    const resize = () => {
        if (state.destroyed) return;
        const bounds = container.getBoundingClientRect();
        const width = Math.max(1, Math.floor(bounds.width));
        const height = Math.max(1, Math.floor(bounds.height));
        renderer.setSize(width, height);
        uniforms.iResolution.value = [width, height];
    };

    const handleWindowResize = () => resize();

    function attachListeners() {
        if (state.listenersAttached || !state.options.mouseInteraction) {
            return;
        }
        window.addEventListener('mousemove', handlePointerMove, { passive: true });
        document.addEventListener('mouseleave', handlePointerLeave, { passive: true });
        state.listenersAttached = true;
    }

    function detachListeners() {
        if (!state.listenersAttached) {
            return;
        }
        window.removeEventListener('mousemove', handlePointerMove);
        document.removeEventListener('mouseleave', handlePointerLeave);
        state.listenersAttached = false;
        state.influenceTarget = 0;
    }

    const handlePointerMove = (event) => {
        if (!state.options.mouseInteraction) {
            state.influenceTarget = 0;
            return;
        }
        const rect = container.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        state.mouseTarget.x = clamp01(x);
        state.mouseTarget.y = clamp01(1 - y); // flip Y to match shader expectation
        const withinX = event.clientX >= rect.left && event.clientX <= rect.right;
        const withinY = event.clientY >= rect.top && event.clientY <= rect.bottom;
        state.influenceTarget = withinX && withinY ? 1 : 0;
    };

    const handlePointerLeave = () => {
        state.influenceTarget = 0;
    };

    const step = (time) => {
        if (state.destroyed) return;

        uniforms.iTime.value = (time * 0.001) * state.options.timeMultiplier;

        const lerp = state.options.mouseLerp;
        state.mouseCurrent.x += (state.mouseTarget.x - state.mouseCurrent.x) * lerp;
        state.mouseCurrent.y += (state.mouseTarget.y - state.mouseCurrent.y) * lerp;

        const influenceLerp = state.options.influenceLerp;
        const targetInfluence = state.options.mouseInteraction ? state.influenceTarget : 0;
        state.influenceValue += (targetInfluence - state.influenceValue) * influenceLerp;
        uniforms.mouseInfluence.value = state.influenceValue;

        uniforms.mousePosition.value = [state.mouseCurrent.x, state.mouseCurrent.y];

        renderer.render({ scene: mesh });
        state.rafId = requestAnimationFrame(step);
    };

    if (typeof ResizeObserver !== 'undefined') {
        state.resizeObserver = new ResizeObserver(resize);
        state.resizeObserver.observe(container);
    }

    window.addEventListener('resize', handleWindowResize, { passive: true });
    resize();
    attachListeners();
    state.rafId = requestAnimationFrame(step);

    const applyOptions = (partial = {}) => {
        state.options = { ...state.options, ...partial };

        uniforms.enableRainbow.value = !!state.options.enableRainbow;
        uniforms.gridColor.value = hexToRgb(state.options.gridColor);
        uniforms.rippleIntensity.value = state.options.rippleIntensity;
        uniforms.gridSize.value = state.options.gridSize;
        uniforms.gridThickness.value = state.options.gridThickness;
        uniforms.fadeDistance.value = state.options.fadeDistance;
        uniforms.vignetteStrength.value = state.options.vignetteStrength;
        uniforms.glowIntensity.value = state.options.glowIntensity;
        uniforms.opacity.value = state.options.opacity;
        uniforms.gridRotation.value = state.options.gridRotation;
        uniforms.mouseInteraction.value = !!state.options.mouseInteraction;
        uniforms.mouseInteractionRadius.value = state.options.mouseInteractionRadius;
        uniforms.autoRippleStrength.value = state.options.autoRippleStrength;
        uniforms.autoRippleSpeed.value = state.options.autoRippleSpeed;
        uniforms.mouseRippleStrength.value = state.options.mouseRippleStrength;
        uniforms.curvatureAmount.value = state.options.curvatureAmount;

        if (!state.options.mouseInteraction) {
            state.influenceTarget = 0;
            detachListeners();
        } else {
            attachListeners();
        }
    };

    const destroy = () => {
        if (state.destroyed) return;
        state.destroyed = true;

        cancelAnimationFrame(state.rafId);
        detachListeners();
        window.removeEventListener('resize', handleWindowResize);
        if (state.resizeObserver) {
            state.resizeObserver.disconnect();
        }
        renderer.gl.getExtension('WEBGL_lose_context')?.loseContext();
        if (gl.canvas.parentNode === container) {
            container.removeChild(gl.canvas);
        }
    };

    return {
        update: applyOptions,
        destroy
    };
}

export default createRippleGrid;
