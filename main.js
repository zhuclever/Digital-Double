// === GLASS SURFACE EFFECT INTEGRATION ===
const qualityState = {
    mode: 'high',
    qualityMultiplier: 1,
    lastSwitch: performance.now()
};
const glassSurfaceSettings = {
    projectButton: {
        borderWidth: 0.03,
        backgroundOpacity: 0.155,
        blur: 7,
        displace: 1.2,
        distortionScale: -110,
        redOffset: 4,
        greenOffset: 12,
        blueOffset: 20,
        mixBlendMode: 'difference',
        getQualityMultiplier: () => (qualityState.mode === 'recovery' ? 0.7 : 1),
        maxFilterResolution: null,
        minFilterResolution: null
    },
    message: {
        base: {
            borderWidth: 0.1,
            backgroundOpacity: 0.1,
            blur: 12,
            displace: 2,
            distortionScale: -150,
            redOffset: 4,
            greenOffset: 12,
            blueOffset: 20,
            mixBlendMode: 'difference',
            maxFilterResolution: 750,
            minFilterResolution: 500,
            getQualityMultiplier: () => (qualityState.mode === 'recovery' ? 0.7 : 1)
        },
        mediaOverrides: {
            borderWidth: 0.13,
            maxFilterResolution: 5,
            minFilterResolution: 5,
            disableFilterAbove: 350
        },
        modelOverrides: {
            borderWidth: 0.13,
            maxFilterResolution: 50,
            minFilterResolution: 30,
        }
    },
    typingIndicator: {
        borderWidth: 0.07,
        backgroundOpacity: 0.15,
        blur: 12,
        displace: 2,
        distortionScale: -150,
        redOffset: 4,
        greenOffset: 12,
        blueOffset: 20,
        mixBlendMode: 'screen',
        getQualityMultiplier: () => (qualityState.mode === 'recovery' ? 0.6 : 1),
        maxFilterResolution: null,
        minFilterResolution: null
    },
    zoomControls: {
        borderWidth: 0.07,
        backgroundOpacity: 0.4,
        blur: 9,
        displace: 0.45,
        distortionScale: -110,
        redOffset: 2,
        greenOffset: 8,
        blueOffset: 14,
        mixBlendMode: 'screen',
        getQualityMultiplier: () => (qualityState.mode === 'recovery' ? 0.7 : 1),
        maxFilterResolution: null,
        minFilterResolution: null
    }
};
const rippleGridSettings = {
    shared: {
        enableRainbow: false,
        gridColor: '#cde4ff',
        rippleIntensity: 0.07,
        gridSize: 8.6,
        gridThickness: 17.5,
        fadeDistance: 2,
        vignetteStrength: 2.5,
        glowIntensity: 0.5,
        opacity: 0.6,
        gridRotation: 0,
        curvatureAmount: 0.2,
        timeMultiplier: 1,
        autoRippleSpeed: 0.5,
        mouseInteractionRadius: 0.24,
        mouseRippleStrength: 0.95,
        maxDpr: 2,
        mouseLerp: 0.12,
        influenceLerp: 0.12
    },
    desktop: {
        autoRippleStrength: 0,
        mouseInteraction: true,
        rippleIntensity: 0.095,
        gridSize: 15,
        gridThickness: 35,
        fadeDistance: 1.7,
        vignetteStrength: 2.5,
        curvatureAmount: 0.3,
        autoRippleSpeed: 0.55,
        glowIntensity: 0.5,
        mouseRippleStrength: 0.5,
        mouseInteractionRadius: 0.35,
        mouseLerp: 0.15,
        influenceLerp: 0.18
    },
    mobile: {
        autoRippleStrength: 1,
        mouseInteraction: false,
        rippleIntensity: 0.055,
        gridSize: 7.8,
        gridThickness: 16.0,
        fadeDistance: 1.25,
        vignetteStrength: 1.6,
        curvatureAmount: 0.18,
        autoRippleSpeed: 0.75,
        glowIntensity: 0.26,
        timeMultiplier: 0.85,
        opacity: 0.9
    }
};

// Track readiness of background canvas and WebGL effects.
function createEffectLoadTracker() {
    const componentNames = ['canvas', 'webgl'];
    const components = new Map();

    function createDeferred(name) {
        let resolved = false;
        let cachedDetail;
        let resolveFn = () => {};
        const promise = new Promise((resolve) => {
            resolveFn = (detail) => {
                if (resolved) {
                    return cachedDetail;
                }
                resolved = true;
                cachedDetail = detail;
                resolve(detail);
                document.dispatchEvent(new CustomEvent('effects:component-ready', {
                    detail: { component: name, payload: detail }
                }));
                if (document.body) {
                    const dataKey = `effects${name.charAt(0).toUpperCase()}${name.slice(1)}Ready`;
                    document.body.dataset[dataKey] = 'true';
                }
                return cachedDetail;
            };
        });

        return {
            promise,
            resolve(detail) {
                return resolveFn(detail);
            },
            isResolved() {
                return resolved;
            },
            getDetail() {
                return cachedDetail;
            }
        };
    }

    componentNames.forEach((name) => {
        components.set(name, createDeferred(name));
    });

    const readyPromise = Promise.all(componentNames.map((name) => components.get(name).promise))
        .then(([canvasDetail, webglDetail]) => {
            const payload = { canvas: canvasDetail, webgl: webglDetail };
            if (document.body) {
                document.body.classList.add('effects-ready');
                document.body.dataset.effectsReady = 'true';
            }
            document.dispatchEvent(new CustomEvent('effects:ready', { detail: payload }));
            return payload;
        });

    return {
        signal(name, detail) {
            if (!components.has(name)) {
                console.warn(`[effects] Unknown component "${name}"`);
                return;
            }
            components.get(name).resolve(detail);
        },
        isComponentReady(name) {
            return components.has(name) ? components.get(name).isResolved() : false;
        },
        whenComponentReady(name) {
            if (!components.has(name)) {
                return Promise.reject(new Error(`Unknown effects component: ${name}`));
            }
            return components.get(name).promise;
        },
        whenReady() {
            return readyPromise;
        },
        getComponentDetail(name) {
            return components.has(name) ? components.get(name).getDetail() : null;
        }
    };
}

const effectLoadTracker = createEffectLoadTracker();
window.effectsLoadTracker = effectLoadTracker;
window.whenEffectsReady = () => effectLoadTracker.whenReady();
window.whenEffectComponentReady = (name) => effectLoadTracker.whenComponentReady(name);

const rippleGridState = {
    modulePromise: null,
    module: null,
    instance: null,
    destroyed: false,
    lastProfile: null
};

let cachedHardwareAccelerationDisabled = null;
let hardwareAccelerationDisabledNotified = false;
// gpu hardware regex
const SOFTWARE_RENDERER_PATTERN = /swiftshader|software|llvmpipe|softpipe|mesa|basic render driver|warp|reference|angle \(software/i;

function isLikelySoftwareRenderer(gl) {
    try {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
            const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
            if (SOFTWARE_RENDERER_PATTERN.test(renderer) || SOFTWARE_RENDERER_PATTERN.test(vendor)) {
                return true;
            }
        }
        const renderer = gl.getParameter(gl.RENDERER) || '';
        const vendor = gl.getParameter(gl.VENDOR) || '';
        return SOFTWARE_RENDERER_PATTERN.test(renderer) || SOFTWARE_RENDERER_PATTERN.test(vendor);
    } catch (error) {
        console.warn('WebGL renderer detection failed', error);
        return false;
    }
}

function cleanupGlContext(gl) {
    if (!gl) {
        return;
    }
    const loseContext = gl.getExtension('WEBGL_lose_context');
    if (loseContext && typeof loseContext.loseContext === 'function') {
        loseContext.loseContext();
    }
}

function setHardwareAccelerationStatus(disabled) {
    cachedHardwareAccelerationDisabled = disabled;
    if (disabled && !hardwareAccelerationDisabledNotified) {
        hardwareAccelerationDisabledNotified = true;
        document.dispatchEvent(
            new CustomEvent('hardwareaccelerationdisabled', {
                detail: { disabled: true }
            })
        );
    }
    return disabled;
}

function detectHardwareAccelerationDisabled() {
    if (cachedHardwareAccelerationDisabled !== null) {
        return cachedHardwareAccelerationDisabled;
    }

    const testCanvas = document.createElement('canvas');
    if (!testCanvas) {
        return setHardwareAccelerationStatus(true);
    }

    const strictAttributes = { failIfMajorPerformanceCaveat: true };
    let gl = testCanvas.getContext('webgl2', strictAttributes) || testCanvas.getContext('webgl', strictAttributes);

    if (gl) {
        const disabled = isLikelySoftwareRenderer(gl);
        cleanupGlContext(gl);
        return setHardwareAccelerationStatus(disabled);
    }

    gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');

    if (!gl) {
        return setHardwareAccelerationStatus(true);
    }

    const disabled = isLikelySoftwareRenderer(gl);
    cleanupGlContext(gl);
    return setHardwareAccelerationStatus(disabled);
}

function getRippleGridProfileKey() {
    return isDesktop ? 'desktop' : 'mobile';
}

function buildRippleGridOptions() {
    const profileKey = getRippleGridProfileKey();
    const profile = rippleGridSettings[profileKey] || {};
    return { ...rippleGridSettings.shared, ...profile };
}

function ensureRippleGridModule() {
    if (!rippleGridState.modulePromise) {
        rippleGridState.modulePromise = import('./RippleGrid_WebGL/Grid.js')
            .then((module) => {
                rippleGridState.module = module;
                return module;
            })
            .catch((error) => {
                rippleGridState.modulePromise = null;
                console.error('Failed to load ripple grid module', error);
                throw error;
            });
    }
    return rippleGridState.modulePromise;
}

function initOrUpdateRippleGrid() {
    if (rippleGridState.destroyed && rippleGridState.instance) {
        return;
    }
    rippleGridState.destroyed = false;
    const container = document.getElementById('rippleGridBackground');
    if (!container) {
        if (!effectLoadTracker.isComponentReady('webgl')) {
            effectLoadTracker.signal('webgl', { error: new Error('Missing ripple grid container') });
        }
        return;
    }

    detectHardwareAccelerationDisabled();

    const profileKey = getRippleGridProfileKey();
    ensureRippleGridModule()
        .then((module) => {
            if (rippleGridState.destroyed) {
                return;
            }
            const options = buildRippleGridOptions();

            if (typeof module.createRippleGrid !== 'function') {
                const error = new Error('Ripple grid module is missing createRippleGrid');
                console.error(error);
                if (!effectLoadTracker.isComponentReady('webgl')) {
                    effectLoadTracker.signal('webgl', { error });
                }
                return;
            }

            let createdInstance = false;

            if (!rippleGridState.instance) {
                rippleGridState.instance = module.createRippleGrid({
                    container,
                    options
                });
                createdInstance = true;
            } else {
                rippleGridState.instance.update(options);
            }

            const schedule =
                typeof window.requestAnimationFrame === 'function'
                    ? window.requestAnimationFrame.bind(window)
                    : (cb) => setTimeout(cb, 0);

            if (createdInstance || !effectLoadTracker.isComponentReady('webgl')) {
                schedule(() => {
                    if (!effectLoadTracker.isComponentReady('webgl')) {
                        effectLoadTracker.signal('webgl', {
                            instance: rippleGridState.instance,
                            module,
                            options,
                            profile: profileKey
                        });
                    }
                });
            }

            rippleGridState.lastProfile = profileKey;
        })
        .catch((error) => {
            console.error('Ripple grid initialization failed', error);
            if (!effectLoadTracker.isComponentReady('webgl')) {
                effectLoadTracker.signal('webgl', { error });
            }
        });
}

function destroyRippleGrid() {
    rippleGridState.destroyed = true;
    if (rippleGridState.instance) {
        rippleGridState.instance.destroy();
        rippleGridState.instance = null;
    }
}
const fpsSamples = [];
let fpsSum = 0;
const MAX_FPS_SAMPLES = 80;
const QUALITY_THRESHOLDS = {
    dropFps: 39,
    raiseFps: 47,
    dropDuration: 1600,
    raiseDuration: 1100
};
let lowFpsSince = null;
let highFpsSince = null;
let lastFpsSampleTime = performance.now();

const GlassSurfaceFX = (() => {
    const svgNS = 'http://www.w3.org/2000/svg';
    const defaultOptions = {
        width: null,
        height: null,
        borderRadius: null,
        borderWidth: 0.07,
        brightness: 40,
        opacity: 0.93,
        blur: 11,
        displace: 0,
        saturation: 2.4,
        backgroundOpacity: 0,
        distortionScale: -180,
        redOffset: 0,
        greenOffset: 10,
        blueOffset: 20,
        xChannel: 'R',
        yChannel: 'G',
        mixBlendMode: 'difference',
        getQualityMultiplier: null,
        maxFilterResolution: null,
        minFilterResolution: null,
        disableFilterAbove: null
    };

    const surfaces = new WeakMap();
    const surfaceList = new Set();
    let idCounter = 0;

    const supportsSvgFilters = (() => {
        const ua = navigator.userAgent;
        const isWebkit = /Safari/.test(ua) && !/Chrome/.test(ua);
        const isFirefox = /Firefox/.test(ua);
        if (isWebkit || isFirefox) {
            return false;
        }
        const testDiv = document.createElement('div');
        testDiv.style.backdropFilter = 'url(#glass-filter)';
        return testDiv.style.backdropFilter !== '';
    })();

    function createSvgStructure(ids) {
        const svg = document.createElementNS(svgNS, 'svg');
        svg.classList.add('glass-surface__filter');

        const defs = document.createElementNS(svgNS, 'defs');
        svg.appendChild(defs);

        const filter = document.createElementNS(svgNS, 'filter');
        filter.setAttribute('id', ids.filterId);
        filter.setAttribute('color-interpolation-filters', 'sRGB');
        filter.setAttribute('x', '0%');
        filter.setAttribute('y', '0%');
        filter.setAttribute('width', '100%');
        filter.setAttribute('height', '100%');
        defs.appendChild(filter);

        const feImage = document.createElementNS(svgNS, 'feImage');
        feImage.setAttribute('x', '0');
        feImage.setAttribute('y', '0');
        feImage.setAttribute('width', '100%');
        feImage.setAttribute('height', '100%');
        feImage.setAttribute('preserveAspectRatio', 'none');
        feImage.setAttribute('result', 'map');
        filter.appendChild(feImage);

        const redChannel = document.createElementNS(svgNS, 'feDisplacementMap');
        redChannel.setAttribute('in', 'SourceGraphic');
        redChannel.setAttribute('in2', 'map');
        redChannel.setAttribute('result', 'dispRed');
        filter.appendChild(redChannel);

        const redMatrix = document.createElementNS(svgNS, 'feColorMatrix');
        redMatrix.setAttribute('in', 'dispRed');
        redMatrix.setAttribute('type', 'matrix');
        redMatrix.setAttribute('values', '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0');
        redMatrix.setAttribute('result', 'red');
        filter.appendChild(redMatrix);

        const greenChannel = document.createElementNS(svgNS, 'feDisplacementMap');
        greenChannel.setAttribute('in', 'SourceGraphic');
        greenChannel.setAttribute('in2', 'map');
        greenChannel.setAttribute('result', 'dispGreen');
        filter.appendChild(greenChannel);

        const greenMatrix = document.createElementNS(svgNS, 'feColorMatrix');
        greenMatrix.setAttribute('in', 'dispGreen');
        greenMatrix.setAttribute('type', 'matrix');
        greenMatrix.setAttribute('values', '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0');
        greenMatrix.setAttribute('result', 'green');
        filter.appendChild(greenMatrix);

        const blueChannel = document.createElementNS(svgNS, 'feDisplacementMap');
        blueChannel.setAttribute('in', 'SourceGraphic');
        blueChannel.setAttribute('in2', 'map');
        blueChannel.setAttribute('result', 'dispBlue');
        filter.appendChild(blueChannel);

        const blueMatrix = document.createElementNS(svgNS, 'feColorMatrix');
        blueMatrix.setAttribute('in', 'dispBlue');
        blueMatrix.setAttribute('type', 'matrix');
        blueMatrix.setAttribute('values', '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0');
        blueMatrix.setAttribute('result', 'blue');
        filter.appendChild(blueMatrix);

        const blendRG = document.createElementNS(svgNS, 'feBlend');
        blendRG.setAttribute('in', 'red');
        blendRG.setAttribute('in2', 'green');
        blendRG.setAttribute('mode', 'screen');
        blendRG.setAttribute('result', 'rg');
        filter.appendChild(blendRG);

        const blendRGB = document.createElementNS(svgNS, 'feBlend');
        blendRGB.setAttribute('in', 'rg');
        blendRGB.setAttribute('in2', 'blue');
        blendRGB.setAttribute('mode', 'screen');
        blendRGB.setAttribute('result', 'output');
        filter.appendChild(blendRGB);

        const gaussianBlur = document.createElementNS(svgNS, 'feGaussianBlur');
        gaussianBlur.setAttribute('in', 'output');
        gaussianBlur.setAttribute('stdDeviation', '0.7');
        filter.appendChild(gaussianBlur);

        return { svg, filter, feImage, redChannel, greenChannel, blueChannel, gaussianBlur };
    }

    function getRadiusPx(element) {
        if (!element) return 0;
        const style = window.getComputedStyle(element);
        const radius = style.borderTopLeftRadius || style.borderRadius || '0';
        const match = radius.match(/[\d.]+/);
        return match ? parseFloat(match[0]) : 0;
    }

    function buildDisplacementMap(width, height, radius, options, ids) {
        const safeRadius = Number.isFinite(radius) ? radius : 0;
        const edgeSize = Math.min(width, height) * (options.borderWidth * 0.5);
        const innerWidth = Math.max(width - edgeSize * 2, 0);
        const innerHeight = Math.max(height - edgeSize * 2, 0);

        const svgContent = `
<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
<defs>
    <linearGradient id="${ids.redGradId}" x1="100%" y1="0%" x2="0%" y2="0%">
    <stop offset="0%" stop-color="#0000"/>
    <stop offset="100%" stop-color="red"/>
    </linearGradient>
    <linearGradient id="${ids.blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#0000"/>
    <stop offset="100%" stop-color="blue"/>
    </linearGradient>
</defs>
<rect x="0" y="0" width="${width}" height="${height}" fill="black"></rect>
<rect x="0" y="0" width="${width}" height="${height}" rx="${safeRadius}" fill="url(#${ids.redGradId})" />
<rect x="0" y="0" width="${width}" height="${height}" rx="${safeRadius}" fill="url(#${ids.blueGradId})" style="mix-blend-mode: ${options.mixBlendMode}" />
<rect x="${edgeSize}" y="${edgeSize}" width="${innerWidth}" height="${innerHeight}" rx="${Math.max(safeRadius - edgeSize, 0)}" fill="hsl(0 0% ${options.brightness}% / ${options.opacity})" style="filter:blur(${options.blur}px)" />
</svg>
`;
        return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
    }

    function markReady(state) {
        if (!state || state.isReady) {
            return;
        }
        state.isReady = true;
        if (state.resolveReady) {
            state.resolveReady();
            state.resolveReady = null;
        }
    }

    function scheduleUpdate(state) {
        if (state.raf) {
            cancelAnimationFrame(state.raf);
        }
        state.raf = requestAnimationFrame(() => {
            updateSurface(state);
            state.raf = null;
        });
    }

    function updateSurface(state) {
        if (!state.host.isConnected) {
            state.pending = true;
            return;
        }

        const rect = state.measureTarget.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width * 10)/10);
        const height = Math.max(1, Math.round(rect.height * 10)/10);
        if (!width || !height) {
            return;
        }

        const disableThreshold = Number.isFinite(state.options.disableFilterAbove)
            ? state.options.disableFilterAbove
            : null;

        if (disableThreshold && (width > disableThreshold || height > disableThreshold)) {
            state.container.classList.remove('glass-surface--svg');
            state.container.classList.add('glass-surface--fallback');
            state.container.style.removeProperty('--filter-id');
            state.container.style.removeProperty('--glass-frost');
            state.container.style.removeProperty('--glass-saturation');
            state.feImage.removeAttribute('href');
            state.pending = false;
            markReady(state);
            return;
        }

        const radius = getRadiusPx(state.radiusSource);
        const qualityMultiplier = typeof state.options.getQualityMultiplier === 'function'
            ? state.options.getQualityMultiplier()
            : (qualityState.mode === 'recovery' ? qualityState.qualityMultiplier : 1);

        const adjustedOptions = {
            ...state.options,
            blur: Math.max(0, state.options.blur * (0.7 + 0.3 * qualityMultiplier)),
            displace: state.options.displace * qualityMultiplier,
            distortionScale: state.options.distortionScale * qualityMultiplier
        };

        const dpr = window.devicePixelRatio || 1;
        const maxResOption = Number.isFinite(state.options.maxFilterResolution) ? state.options.maxFilterResolution : null;
        const minResOption = Number.isFinite(state.options.minFilterResolution) ? state.options.minFilterResolution : null;
        const maxDimension = Math.max(width, height);
        let resolutionScale = 1;

        if (maxResOption && maxResOption > 0) {
            const limit = maxResOption * dpr;
            if (maxDimension > limit) {
                resolutionScale = limit / maxDimension;
            }
        }

        if (minResOption && minResOption > 0) {
            const minLimit = minResOption * dpr;
            const minScale = Math.min(1, minLimit / maxDimension);
            resolutionScale = Math.max(resolutionScale, minScale);
        }

        const renderWidth = Math.max(1, Math.round(width * resolutionScale));
        const renderHeight = Math.max(1, Math.round(height * resolutionScale));
        const renderRadius = Math.max(0, radius * resolutionScale);

        if (state.filter) {
            state.filter.setAttribute('filterRes', `${renderWidth} ${renderHeight}`);
        }

        const mapUrl = buildDisplacementMap(renderWidth, renderHeight, renderRadius, adjustedOptions, state.ids);
        state.feImage.setAttribute('href', mapUrl);

        [
            { ref: state.redChannel, offset: state.options.redOffset },
            { ref: state.greenChannel, offset: state.options.greenOffset },
            { ref: state.blueChannel, offset: state.options.blueOffset }
        ].forEach(({ ref, offset }) => {
            ref.setAttribute('scale', (adjustedOptions.distortionScale + offset).toString());
            ref.setAttribute('xChannelSelector', state.options.xChannel);
            ref.setAttribute('yChannelSelector', state.options.yChannel);
        });

        state.gaussianBlur.setAttribute('stdDeviation', Math.max(0, adjustedOptions.displace).toString());

        state.container.classList.remove('glass-surface--fallback');
        state.container.style.setProperty('--filter-id', `url(#${state.ids.filterId})`);
        state.container.style.setProperty('--glass-frost', state.options.backgroundOpacity);
        state.container.style.setProperty('--glass-saturation', state.options.saturation);
        state.container.style.borderRadius = `${radius}px`;

        state.container.classList.toggle('glass-surface--svg', supportsSvgFilters);
        state.container.classList.toggle('glass-surface--fallback', !supportsSvgFilters);

        state.pending = false;
        markReady(state);
    }

    function forceRefresh(host) {
        const state = surfaces.get(host);
        if (!state) {
            return;
        }
        if (state.raf) {
            cancelAnimationFrame(state.raf);
            state.raf = null;
        }
        updateSurface(state);
    }

    function attach({
        host,
        contentElement = host,
        className = '',
        options = {},
        measureTarget,
        radiusSource
    }) {
        if (!host) return null;

        const existing = surfaces.get(host);
        if (existing) {
            existing.options = { ...existing.options, ...options };
            if (className) {
                existing.container.classList.add(className);
            }
            scheduleUpdate(existing);
            return existing;
        }

        const suffix = (++idCounter).toString(36);
        const ids = {
            filterId: `glass-filter-${suffix}`,
            redGradId: `glass-red-${suffix}`,
            blueGradId: `glass-blue-${suffix}`
        };

        const { svg, filter, feImage, redChannel, greenChannel, blueChannel, gaussianBlur } = createSvgStructure(ids);

        const container = document.createElement('div');
        container.className = ['glass-surface', className].filter(Boolean).join(' ');
        container.style.width = '100%';
        container.style.height = '100%';

        container.appendChild(svg);

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'glass-surface__content';
        container.appendChild(contentWrapper);


        if (contentElement === host) {
            while (host.firstChild) {
                contentWrapper.appendChild(host.firstChild);
            }
            host.appendChild(container);
        } else {
            const parent = contentElement.parentNode;
            if (!parent) return null;
            parent.insertBefore(container, contentElement);
            contentWrapper.appendChild(contentElement);
        }

        //Add CSS styled highlight for message bubble with glass effect
        //constrct highlight and blend layers
        let highlightSubClass = '';
        if (host.classList.contains('project-button')){
            highlightSubClass = 'buttons';
        }else if(host.classList.contains('message-content')){
            highlightSubClass = 'messages';
        }else if(host.classList.contains('typing-dots')){
            highlightSubClass = 'typings';
        }else if(host.classList.contains('zoom-controls')){
            highlightSubClass = 'typings';
        }
        const highlightWrapper = document.createElement('div');
        highlightWrapper.className = `glass-highlight-wrapper ${highlightSubClass}`;
        const highlightInner = document.createElement('div');
        highlightInner.className = `glass-highlight ${highlightSubClass}`;
        const highlightTint = document.createElement('div');
        highlightTint.className = 'glass-highlight-tint';

        highlightWrapper.appendChild(highlightInner);
        highlightWrapper.appendChild(highlightTint);

        const blendOverlay = document.createElement('div');
        blendOverlay.className = 'glass-blend-overlay';

        container.insertBefore(highlightWrapper, contentWrapper);
        container.insertBefore(blendOverlay, contentWrapper);

        //
        let readyResolve;
        const readyPromise = new Promise((resolve) => {
            readyResolve = resolve;
        });

        const state = {
            host,
            container,
            contentWrapper,
            contentElement,
            ids,
            options: { ...defaultOptions, ...options },
            filter,
            feImage,
            redChannel,
            greenChannel,
            blueChannel,
            gaussianBlur,
            readyPromise,
            resolveReady: readyResolve,
            isReady: false,
            measureTarget: measureTarget || container,
            radiusSource: radiusSource || host,
            observer: null,
            raf: null,
            pending: false
        };

        const observer = new ResizeObserver(() => scheduleUpdate(state));
        observer.observe(state.measureTarget);
        state.observer = observer;

        surfaces.set(host, state);
        surfaceList.add(state);

        scheduleUpdate(state);

        return state;
    }

    function refreshAll() {
        surfaceList.forEach((state) => scheduleUpdate(state));
    }

    return {
        attach,
        refreshAll,
        forceRefresh,
        supportsSvg: () => supportsSvgFilters
    };
})();

// === CANVAS BACKGROUND EFFECT ===

const minFontSize = 5;  
const maxFontSize = 180;
const shrinkDelay = 1800;
const shrinkDuration = 800;
const shuffleInterval = 100;

const sourceText = "There was a table set out under a tree in front of the house, and the March Hare and the Hatter were having tea at it: a Dormouse was sitting between them, fast asleep, and the other two were using it as a cushion, resting their elbows on it, and talking over its head. 'Very uncomfortable for the Dormouse,' thought Alice; 'only, as it's asleep, I suppose it doesn't mind.'";

const keyboardChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/~`';

// Canvas State
let bgCanvas, bgCtx;
let mouse = { x: 0, y: 0 };
let lastPosition = { x: 0, y: 0 };
let textIndex = 0;
let letters = [];
let isDrawing = false;
let lastDrawTime = 0;
let animationId = null;
let lastCanvasRenderTime = 0;
let canvasPixelRatio = 1;
let canvasPauseCount = 0;
let inactivityTimer = null;
let canvasPauseStarted = null;
const INACTIVITY_TIMEOUT = 4000;
const CANVAS_TARGET_FPS = 30;
const canvas_text_init_color = { value: 250, alpha: -0.05 };
const canvas_text_target_color = { value: 120, alpha: 1 };
const canvas_text_end_color = { value: 0, alpha: 0.9 };
const canvas_text_color_transition_delay = 450;
const canvas_text_shrink_delay = 200;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function cloneCanvasColor(colorConfig) {
    return { value: colorConfig.value, alpha: colorConfig.alpha };
}

function interpolateCanvasColor(startColor, endColor, progress) {
    const t = clamp(typeof progress === 'number' ? progress : 0, 0, 1);
    return {
        value: startColor.value + (endColor.value - startColor.value) * t,
        alpha: startColor.alpha + (endColor.alpha - startColor.alpha) * t
    };
}

// Surprise letter system (rare occurrence)
let letterCounter = 0;
let nextSurpriseAt = 50 + Math.floor(Math.random() * 31); // Next surprise at 50-80 letters

// Performance: ENHANCED pre-calculated shuffled chars (2.5x more variations)
const shuffledCharsCache = new Array(25).fill(null).map(() => {
    return new Array(50).fill(null).map(() => 
        keyboardChars[Math.floor(Math.random() * keyboardChars.length)]
    );
});

class Letter {
    constructor(char, x, y, size, angle) {
        this.originalChar = char;
        this.currentChar = char;
        this.x = x;
        this.y = y;
        this.originalSize = size;
        this.currentSize = size;
        this.angle = angle;
        this.birthTime = Date.now();
        this.scale = 1;
        this.isShuffling = false;
        this.lastShuffleTime = 0;
        this.shuffleCacheIndex = Math.floor(Math.random() * 25);
        this.shuffleIndex = 0;
        this.currentColor = cloneCanvasColor(canvas_text_init_color);
    }

    update(currentTimestamp = Date.now()) {
        const age = currentTimestamp - this.birthTime;

        if (age <= shrinkDelay) {
            const colorDelay = clamp(canvas_text_color_transition_delay, 0, shrinkDelay);

            this.scale = 1;
            this.currentSize = this.originalSize;

            if (age <= colorDelay) {
                this.currentColor = cloneCanvasColor(canvas_text_init_color);
            } else {
                const effectiveDuration = Math.max(shrinkDelay - colorDelay, 1);
                const normalizedAge = (age - colorDelay) / effectiveDuration;
                const colorProgress = clamp(normalizedAge, 0, 1);
                this.currentColor = interpolateCanvasColor(
                    canvas_text_init_color,
                    canvas_text_target_color,
                    colorProgress
                );
            }

            return false;
        }

        const shrinkAge = age - shrinkDelay;
        const shrinkHold = Math.max(canvas_text_shrink_delay, 0);

        if (shrinkAge <= shrinkHold) {
            this.scale = 1;
            this.currentSize = this.originalSize;
            this.currentColor = cloneCanvasColor(canvas_text_target_color);
            this.isShuffling = false;
            return false;
        }

        if (!this.isShuffling || (currentTimestamp - this.lastShuffleTime) > shuffleInterval) {
            this.isShuffling = true;
            // Use pre-calculated shuffled characters for better performance
            this.currentChar = shuffledCharsCache[this.shuffleCacheIndex][this.shuffleIndex % 50];
            this.shuffleIndex++;
            this.lastShuffleTime = currentTimestamp;
        }

        const effectiveShrinkAge = shrinkAge - shrinkHold;
        const shrinkProgress = shrinkDuration === 0 ? 1 : Math.min(effectiveShrinkAge / shrinkDuration, 1);

        this.scale = Math.max(0, 1 - shrinkProgress);
        this.currentSize = this.originalSize * this.scale;
        this.currentColor = interpolateCanvasColor(
            canvas_text_target_color,
            canvas_text_end_color,
            shrinkProgress
        );

        return shrinkProgress >= 1;
    }

    draw(context) {
        if (this.scale <= 0.01) return; // Skip very small letters

        const color = this.currentColor || canvas_text_init_color;
        const gray = Math.round(clamp(color.value, 0, 255));
        const alpha = clamp(color.alpha, 0, 1);

        context.save();
        context.font = `${this.currentSize}px Georgia`;
        context.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${alpha})`;
        context.translate(this.x, this.y);
        context.rotate(this.angle);
        context.fillText(this.currentChar, 0, 0);
        context.restore();
    }
}

function initCanvas() {
    bgCanvas = document.getElementById('bgCanvas');
    if (!bgCanvas) {
        const error = new Error('Missing #bgCanvas element');
        console.error(error);
        if (!effectLoadTracker.isComponentReady('canvas')) {
            effectLoadTracker.signal('canvas', { error });
        }
        return;
    }

    bgCtx = bgCanvas.getContext('2d', {
        alpha: true,
        desynchronized: true // Better performance for canvas updates
    });

    if (!bgCtx) {
        const error = new Error('Failed to acquire 2D context for background canvas');
        console.error(error);
        if (!effectLoadTracker.isComponentReady('canvas')) {
            effectLoadTracker.signal('canvas', { error });
        }
        return;
    }

    resizeCanvas();

    if (!effectLoadTracker.isComponentReady('canvas')) {
        effectLoadTracker.signal('canvas', {
            canvas: bgCanvas,
            context: bgCtx,
            pixelRatio: canvasPixelRatio,
            size: {
                width: bgCanvas.width,
                height: bgCanvas.height,
                cssWidth: bgCanvas.style.width,
                cssHeight: bgCanvas.style.height
            }
        });
    }

    document.addEventListener('mousemove', handleCanvasMouseMove, { passive: true });
    document.addEventListener('mouseenter', handleCanvasMouseEnter, { passive: true });
    document.addEventListener('mouseleave', handleCanvasMouseLeave, { passive: true });
    window.addEventListener('resize', resizeCanvas, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

function resizeCanvas(force = false) {
    if (typeof force !== 'boolean') {
        force = false;
    }

    if (!bgCanvas || !bgCtx) {
        return;
    }

    const dprCap = qualityState.mode === 'recovery' ? 1 : 1.5;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const width = window.innerWidth;
    const height = window.innerHeight;

    const targetWidth = Math.round(width * dpr);
    const targetHeight = Math.round(height * dpr);

    if (!force && canvasPixelRatio === dpr && bgCanvas.width === targetWidth && bgCanvas.height === targetHeight) {
        return;
    }

    canvasPixelRatio = dpr;
    bgCanvas.width = targetWidth;
    bgCanvas.height = targetHeight;

    bgCanvas.style.width = `${width}px`;
    bgCanvas.style.height = `${height}px`;

    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function startCanvasAnimation() {
    if (canvasPauseCount > 0) {
        return;
    }
    if (animationId === null && letters.length > 0 && !document.hidden) {
        animationId = requestAnimationFrame(animateCanvas);
    }
}

function stopCanvasAnimation() {
    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    lastCanvasRenderTime = 0;
}

function pauseCanvasDuringConversation() {
    if (canvasPauseCount === 0) {
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
            inactivityTimer = null;
        }
        isDrawing = false;
        stopCanvasAnimation();
        canvasPauseStarted = Date.now();
    }
    canvasPauseCount++;
}

function resumeCanvasAfterConversation() {
    if (canvasPauseCount === 0) {
        return;
    }
    canvasPauseCount--;
    if (canvasPauseCount === 0) {
        if (canvasPauseStarted) {
            const pauseDuration = Date.now() - canvasPauseStarted;
            letters.forEach(letter => {
                letter.birthTime += pauseDuration;
            });
            canvasPauseStarted = null;
        }
        if (letters.length > 0 && !document.hidden) {
            startCanvasAnimation();
        }
        resetCanvasInactivityTimer();
    }
}

function resetCanvasInactivityTimer() {
    if (canvasPauseCount > 0) {
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
            inactivityTimer = null;
        }
        return;
    }
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    inactivityTimer = setTimeout(() => {
        isDrawing = false;
        inactivityTimer = null;
    }, INACTIVITY_TIMEOUT);
}

function handleVisibilityChange() {
    if (document.hidden) {
        stopCanvasAnimation();
    } else if (letters.length > 0 && canvasPauseCount === 0) {
        startCanvasAnimation();
    }
}

function handleCanvasMouseMove(e) {
    if (canvasPauseCount > 0) {
        return;
    }

    mouse.x = e.clientX;
    mouse.y = e.clientY;

    if (!isDrawing) {
        lastPosition.x = mouse.x;
        lastPosition.y = mouse.y;
        isDrawing = true;
    }

    drawCanvasText();
    resetCanvasInactivityTimer();
}

function handleCanvasMouseEnter(e) {
    if (canvasPauseCount > 0) {
        return;
    }
    isDrawing = true;
    lastPosition.x = e.clientX;
    lastPosition.y = e.clientY;
    resetCanvasInactivityTimer();
}

function handleCanvasMouseLeave() {
    isDrawing = false;
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
}

function drawCanvasText() {
    if (!isDrawing || canvasPauseCount > 0) return;
    
    const currentTime = Date.now();
    const minDrawInterval = qualityState.mode === 'recovery' ? 16 : 10;
    if (currentTime - lastDrawTime < minDrawInterval) return; // Throttle drawing
    
    const dx = mouse.x - lastPosition.x;
    const dy = mouse.y - lastPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > minFontSize) {
        let fontSize;
        
        // INCREMENT LETTER COUNTER
        letterCounter++;
        
        // CHECK FOR SURPRISE LETTER (RARE OCCURRENCE)
        let isSurpriseLetter = false;
        if (letterCounter >= nextSurpriseAt) {
            // Calculate what the size SHOULD be based on speed
            const normalizedDistance = Math.min(distance / 500, 1);
            const expectedSize = minFontSize + (normalizedDistance * (maxFontSize - minFontSize));
            
            // Only apply surprise if expected size is small or large, not medium
            if (expectedSize < 35 || expectedSize > 90) {
                isSurpriseLetter = true;
            }
            
            // Set next surprise far in the future
            nextSurpriseAt = letterCounter + 50 + Math.floor(Math.random() * 31); // Next surprise in 50-80 letters
        }
        
        if (isSurpriseLetter) {
            // SURPRISE LETTER - DRASTICALLY DIFFERENT SIZE
            const normalizedDistance = Math.min(distance / 500, 1);
            const expectedSize = minFontSize + (normalizedDistance * (maxFontSize - minFontSize));
            
            // Now do the opposite!
            if (expectedSize < 35) {
                // Expected small, make it big!
                fontSize = 90 + Math.random() * 60; // 90-150
            } else if (expectedSize > 90) {
                // Expected big, make it small!
                fontSize = minFontSize + Math.random() * 20; // 8-28
            }
        } else {
            // NORMAL LETTER - EVEN MORE GRADUAL SCALING FOR MEDIUM SPEEDS
            
            // Normalize distance to 0-1 range (increased to 600 for even more gradual growth)
            const normalizedDistance = Math.min(distance / 600, 1);
            
            // Use an even gentler logarithmic curve
            // Using smaller multiplier (2 instead of 3) for slower growth
            const logCurve = Math.log2(normalizedDistance * 2 + 1) / Math.log2(3); // Results in 0 to 1
            
            // Apply a much gentler power curve (reduced from 1.2 to 1.1)
            const curveWithAccel = Math.pow(logCurve, 1.1);
            
            // Additional dampening for medium speeds
            let scaleFactor = curveWithAccel;
            if (distance > 30 && distance < 200) {
                // Medium speed - apply extra dampening
                scaleFactor = scaleFactor * 0.7; // Reduce by 30%
            }
            
            // Map to font size range with some randomness for variety
            const randomFactor = 0.95 + Math.random()*1; // 95% to 105% (less variation)
            fontSize = minFontSize + (scaleFactor * (maxFontSize - minFontSize) * randomFactor);
            
            // Special handling for very slow/fast movements
            if (distance < 15) {
                // Very slow movement - keep text quite small
                fontSize = minFontSize + Math.random() * 6;
            } else if (distance > 400) {
                // Very fast movement - allow large sizes
                fontSize = fontSize * (0.9 + Math.random() * 0.2);
            }
        }
        
        // Ensure we stay within bounds
        fontSize = Math.max(minFontSize, Math.min(fontSize, maxFontSize));
        
        const angle = Math.atan2(dy, dx);
        const char = sourceText[textIndex % sourceText.length];
        
        const letter = new Letter(char, lastPosition.x, lastPosition.y, fontSize, angle);
        letters.push(letter);
        startCanvasAnimation();
        
        // Performance optimization: limit array size more aggressively
        const maxLetters = qualityState.mode === 'recovery' ? 190 : 270;
        if (letters.length > maxLetters) {
            letters.splice(0, letters.length - maxLetters);
        }
        
        bgCtx.font = `${fontSize}px Georgia`;
        const stepSize = bgCtx.measureText(char).width;
        
        lastPosition.x += Math.cos(angle) * stepSize;
        lastPosition.y += Math.sin(angle) * stepSize;
        
        textIndex++;
        lastDrawTime = currentTime;
    }
}

function animateCanvas() {
    if (canvasPauseCount > 0) {
        animationId = null;
        return;
    }

    const now = performance.now();
    const targetFrameInterval = 1000 / CANVAS_TARGET_FPS; // canvas fps throttle cap

    if ((now - lastCanvasRenderTime) < targetFrameInterval) {
        animationId = requestAnimationFrame(animateCanvas);
        return;
    }

    lastCanvasRenderTime = now;

    if (!bgCanvas || !bgCtx) {
        animationId = null;
        return;
    }

    bgCtx.clearRect(0, 0, bgCanvas.width / canvasPixelRatio, bgCanvas.height / canvasPixelRatio);

    const renderTimestamp = Date.now();

    letters = letters.filter(letter => {
        const shouldRemove = letter.update(renderTimestamp);
        if (!shouldRemove) {
            letter.draw(bgCtx);
        }
        return !shouldRemove;
    });

    if (letters.length > 0 && !document.hidden) {
        animationId = requestAnimationFrame(animateCanvas);
    } else {
        animationId = null;
    }
}


// === PRELOADING FUNCTIONS ===

// Preload a single image
function preloadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        const timeout = setTimeout(() => {
            reject(new Error(`Image load timeout: ${src}`));
        }, 30000); // 30 second timeout
        
        img.onload = () => {
            clearTimeout(timeout);
            resolve(img);
        };
        
        img.onerror = () => {
            clearTimeout(timeout);
            reject(new Error(`Failed to load image: ${src}`));
        };
        
        img.src = src;
    });
}

// Preload video metadata
function preloadVideoMetadata(src) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        
        const timeout = setTimeout(() => {
            reject(new Error(`Video metadata load timeout: ${src}`));
        }, 30000); // 30 second timeout
        
        video.onloadedmetadata = () => {
            clearTimeout(timeout);
            resolve(video);
        };
        
        video.onerror = () => {
            clearTimeout(timeout);
            reject(new Error(`Failed to load video metadata: ${src}`));
        };
        
        video.preload = 'metadata';
        video.src = src;
    });
}

function preloadAudioMetadata(src) {
    return new Promise((resolve) => {
        const audio = new Audio();
        let settled = false;

        const finalize = () => {
            if (settled) return;
            settled = true;
            audio.removeEventListener('loadedmetadata', finalize);
            audio.removeEventListener('canplaythrough', finalize);
            audio.removeEventListener('error', finalize);
            audio.src = '';
            resolve(audio);
        };

        audio.preload = 'auto';
        audio.addEventListener('loadedmetadata', finalize);
        audio.addEventListener('canplaythrough', finalize);
        audio.addEventListener('error', finalize);
        audio.src = src;
        audio.load();
    });
}

// Preload content based on type
async function preloadContent(type, content) {
    try {
        if (type === 'image') {
            const srcMatch = content.match(/src="([^"]+)"/);
            if (srcMatch) {
                const preloadImg = new Image();
                preloadImg.decoding = 'async';
                preloadImg.src = srcMatch[1];

                if (typeof preloadImg.decode === 'function') {
                    try {
                        await preloadImg.decode();
                    } catch (err) {
                        await new Promise((resolve) => {
                            preloadImg.addEventListener('load', resolve, { once: true });
                            preloadImg.addEventListener('error', resolve, { once: true });
                        });
                    }
                } else {
                    await new Promise((resolve) => {
                        preloadImg.addEventListener('load', resolve, { once: true });
                        preloadImg.addEventListener('error', resolve, { once: true });
                    });
                }
            }
        } else if (type === 'video') {
            const srcMatch = content.match(/src="([^"]+)"/);
            if (srcMatch) {
                await preloadVideoMetadata(srcMatch[1]);
            }
        } else if (type === 'audio') {
            const srcMatch = content.match(/src="([^"]+)"/);
            if (srcMatch) {
                await preloadAudioMetadata(srcMatch[1]);
            }
        }
    } catch (error) {
        console.warn(`Preload failed for ${type}:`, error);
        // Continue anyway - show content even if preload fails
    }
}

const videoPosterCache = new Map();

async function ensureVideoPoster(videoSrc, suppliedPoster) {
    if (suppliedPoster) {
        return suppliedPoster;
    }
    if (!videoSrc) {
        return null;
    }
    if (videoPosterCache.has(videoSrc)) {
        return videoPosterCache.get(videoSrc) || null;
    }

    try {
        const generatedPoster = await generatePosterFromVideo(videoSrc);
        videoPosterCache.set(videoSrc, generatedPoster || '');
        return generatedPoster;
    } catch (error) {
        console.warn('Poster generation failed:', error);
        videoPosterCache.set(videoSrc, '');
        return null;
    }
}

async function generatePosterFromVideo(videoSrc) {
    if (!videoSrc) {
        return null;
    }

    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        let settled = false;

        const cleanup = () => {
            video.pause();
            video.removeAttribute('src');
            video.load();
        };

        const fail = (error) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(error);
        };

        const handleLoadedData = () => {
            try {
                if (!video.videoWidth || !video.videoHeight) {
                    throw new Error('Video dimensions unavailable');
                }

                const maxDimension = 1280;
                const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
                const width = Math.round(video.videoWidth * scale) || video.videoWidth;
                const height = Math.round(video.videoHeight * scale) || video.videoHeight;

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext('2d');

                context.drawImage(video, 0, 0, width, height);

                const maxBytes = 100 * 1024;
                let quality = 0.85;
                const minQuality = 0.45;

                const estimateBytes = (dataUrl) => {
                    const base64 = dataUrl.split(',')[1] || '';
                    return Math.ceil(base64.length * 0.75);
                };

                let dataUrl = canvas.toDataURL('image/jpeg', quality);
                while (estimateBytes(dataUrl) > maxBytes && quality > minQuality) {
                    quality = Math.max(minQuality, quality - 0.1);
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }

                settled = true;
                cleanup();
                resolve(dataUrl);
            } catch (generationError) {
                fail(generationError);
            }
        };

        video.addEventListener('loadeddata', handleLoadedData, { once: true });
        video.addEventListener('error', () => fail(new Error(`Failed to load video for poster: ${videoSrc}`)), { once: true });

        try {
            video.crossOrigin = 'anonymous';
        } catch (crossOriginError) {
            // Ignore if crossOrigin cannot be set
        }
        video.muted = true;
        video.preload = 'auto';
        video.src = videoSrc;
        video.load();
    });
}

// === CHAT INTERFACE LOGIC ===
// === VIDEO PLAYBACK COORDINATION ===
const managedVideos = new Set();
let currentPlayingVideo = null;
let videoVisibilityObserver = null;

const managedAudios = new Set();
let currentPlayingAudio = null;

function ensureVideoObserver() {
    if (!videoVisibilityObserver && typeof IntersectionObserver !== 'undefined') {
        videoVisibilityObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target;
                if (!entry.isIntersecting && !video.paused && !video.ended) {
                    video.pause();
                }
            });
        }, {
            root: null,
            threshold: 0.1
        });
    }
    return videoVisibilityObserver;
}

function registerVideoElement(video) {
    if (!video || managedVideos.has(video)) return;
    managedVideos.add(video);

    video.addEventListener('play', handleManagedVideoPlay);
    video.addEventListener('pause', handleManagedVideoPause);
    video.addEventListener('ended', handleManagedVideoEnded);

    const observer = ensureVideoObserver();
    if (observer) {
        observer.observe(video);
    }

    if (!video.paused && !video.ended) {
        handleManagedVideoPlay({ currentTarget: video });
    }
}

function deregisterVideoElement(video) {
    if (!video || !managedVideos.has(video)) return;
    managedVideos.delete(video);

    video.removeEventListener('play', handleManagedVideoPlay);
    video.removeEventListener('pause', handleManagedVideoPause);
    video.removeEventListener('ended', handleManagedVideoEnded);

    if (videoVisibilityObserver) {
        videoVisibilityObserver.unobserve(video);
    }

    if (currentPlayingVideo === video) {
        currentPlayingVideo = null;
    }
}

function handleManagedVideoPlay(event) {
    const video = event && event.currentTarget ? event.currentTarget : event;
    if (!video) return;
    pauseAllManagedVideos(video);
    pauseAllManagedAudios();
    currentPlayingVideo = video;
}

function handleManagedVideoPause(event) {
    const video = event && event.currentTarget ? event.currentTarget : event;
    if (!video) return;
    if (currentPlayingVideo === video && (video.paused || video.ended)) {
        currentPlayingVideo = null;
    }
}
function handleManagedVideoEnded(event) {
    const video = event && event.currentTarget ? event.currentTarget : event;
    if (!video) return;
    if (currentPlayingVideo === video) {
        currentPlayingVideo = null;
    }
}

function pauseAllManagedVideos(except = null) {
    managedVideos.forEach((video) => {
        if (video !== except && !video.paused) {
            video.pause();
        }
    });
}

function pauseAllManagedAudios(except = null) {
    managedAudios.forEach((audio) => {
        if (audio !== except && !audio.paused) {
            audio.pause();
        }
    });
}

function formatAudioTime(seconds) {
    if (!isFinite(seconds) || seconds <= 0) {
        return '0:00';
    }
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const remainder = totalSeconds % 60;
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function registerAudioMessage(container) {
    if (!container) return;
    const audio = container.querySelector('audio');
    if (!audio || managedAudios.has(audio)) return;

    const playButton = container.querySelector('.audio-button');
    const durationLabel = container.querySelector('.audio-duration');
    const progressBar = container.querySelector('.audio-waveform-progress');
    const prevButton = container.querySelector('.audio-nav.audio-prev');
    const nextButton = container.querySelector('.audio-nav.audio-next');

    let tracks = [];
    const tracksAttr = container.getAttribute('data-audio-tracks');
    if (tracksAttr) {
        try {
            const parsed = JSON.parse(tracksAttr);
            if (Array.isArray(parsed)) {
                tracks = parsed
                    .map(src => (typeof src === 'string' ? src.trim() : ''))
                    .filter(src => src.length > 0);
            }
        } catch (err) {
            tracks = [];
        }
    }

    if (!tracks.length) {
        const fallbackSrc = audio.getAttribute('src') || audio.src || '';
        if (fallbackSrc) {
            tracks = [fallbackSrc];
        }
    }

    let currentIndex = Number.parseInt(container.dataset.audioIndex, 10);
    if (!Number.isFinite(currentIndex)) {
        currentIndex = 0;
    }
    currentIndex = Math.max(0, Math.min(currentIndex, Math.max(0, tracks.length - 1)));
    container.dataset.audioIndex = String(currentIndex);

    const assignAudioSource = (src, { reload = false } = {}) => {
        if (!src) return;
        const currentAttr = audio.getAttribute('src') || '';
        let shouldReload = reload;
        if (currentAttr !== src) {
            audio.setAttribute('src', src);
            shouldReload = true;
        }
        if (shouldReload) {
            audio.load();
        }
    };

    assignAudioSource(tracks[currentIndex] || '', { reload: false });

    const updateNavState = () => {
        const total = tracks.length;
        const hasMultipleTracks = total > 1;
        container.classList.toggle('has-multiple-tracks', hasMultipleTracks);
        container.classList.toggle('single-track', !hasMultipleTracks);

        const baseLabel = container.dataset.audioLabel || 'Audio message';
        if (hasMultipleTracks) {
            container.setAttribute('aria-label', `${baseLabel} (${currentIndex + 1} of ${total})`);
        } else {
            container.setAttribute('aria-label', baseLabel);
        }

        if (prevButton) {
            const canNavigate = hasMultipleTracks;
            prevButton.disabled = !canNavigate;
            prevButton.setAttribute(
                'aria-label',
                canNavigate
                    ? `Previous audio (${((currentIndex - 1 + total) % total) + 1} of ${total})`
                    : 'Previous audio message'
            );
        }

        if (nextButton) {
            const canNavigate = hasMultipleTracks;
            nextButton.disabled = !canNavigate;
            nextButton.setAttribute(
                'aria-label',
                canNavigate
                    ? `Next audio (${((currentIndex + 1) % total) + 1} of ${total})`
                    : 'Next audio message'
            );
        }
    };

    managedAudios.add(audio);

    const setPlayingState = (isPlaying) => {
        container.classList.toggle('is-playing', isPlaying);
        if (playButton) {
            playButton.classList.toggle('is-playing', isPlaying);
        }
    };

    const updateDurationLabel = () => {
        if (!durationLabel) return;
        if (isFinite(audio.duration) && audio.duration > 0) {
            const timeValue = audio.paused ? audio.duration : Math.max(audio.duration - audio.currentTime, 0);
            durationLabel.textContent = formatAudioTime(timeValue);
        } else if (audio.currentTime > 0 && !isFinite(audio.duration)) {
            durationLabel.textContent = formatAudioTime(audio.currentTime);
        } else {
            durationLabel.textContent = '0:00';
        }
    };

    const updateProgress = () => {
        if (!progressBar) return;
        if (!isFinite(audio.duration) || audio.duration === 0) {
            progressBar.style.width = '0%';
            return;
        }
        const ratio = Math.min(1, Math.max(0, audio.currentTime / audio.duration));
        progressBar.style.width = `${(ratio * 100).toFixed(2)}%`;
    };

    const resetProgress = () => {
        if (progressBar) {
            progressBar.style.width = '0%';
        }
    };

    const handlePlay = () => {
        pauseAllManagedAudios(audio);
        pauseAllManagedVideos();
        currentPlayingAudio = audio;
        setPlayingState(true);
        updateDurationLabel();
    };

    const handlePause = () => {
        if (currentPlayingAudio === audio && (audio.paused || audio.ended)) {
            currentPlayingAudio = null;
        }
        setPlayingState(false);
        updateDurationLabel();
    };

    const handleEnded = () => {
        audio.currentTime = 0;
        updateProgress();
        handlePause();
    };

    const handleTimeUpdate = () => {
        updateProgress();
        updateDurationLabel();
    };

    const handleLoadedMetadata = () => {
        resetProgress();
        updateDurationLabel();
        updateNavState();
    };

    const setTrack = (nextIndex, { autoplay = null, force = false } = {}) => {
        const total = tracks.length;
        if (!total) {
            return;
        }
        let targetIndex = ((nextIndex % total) + total) % total;
        if (!force && targetIndex === currentIndex) {
            return;
        }

        const wasPlaying = autoplay === null ? (!audio.paused && !audio.ended) : autoplay;

        audio.pause();
        audio.currentTime = 0;
        resetProgress();

        currentIndex = targetIndex;
        container.dataset.audioIndex = String(currentIndex);
        assignAudioSource(tracks[currentIndex] || '', { reload: true });
        updateNavState();
        updateDurationLabel();

        if (wasPlaying) {
            pauseAllManagedAudios(audio);
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.catch(() => {
                    handlePause();
                });
            }
        }
    };

    const togglePlayback = () => {
        if (audio.paused || audio.ended) {
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.catch(() => {
                    handlePause();
                });
            }
        } else {
            audio.pause();
        }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    if (playButton) {
        playButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            togglePlayback();
        });
    }

    if (prevButton) {
        prevButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            setTrack(currentIndex - 1);
        });
    }

    if (nextButton) {
        nextButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            setTrack(currentIndex + 1);
        });
    }

    container.addEventListener('click', (event) => {
        if ((playButton && playButton.contains(event.target)) ||
            (prevButton && prevButton.contains(event.target)) ||
            (nextButton && nextButton.contains(event.target))) {
            return;
        }
        if (event.target.closest('.audio-waveform') || event.target.classList.contains('audio-duration') || event.target === container) {
            togglePlayback();
        }
    });

    container.addEventListener('keydown', (event) => {
        if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            togglePlayback();
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            setTrack(currentIndex - 1, { autoplay: !audio.paused && !audio.ended });
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            setTrack(currentIndex + 1, { autoplay: !audio.paused && !audio.ended });
        }
    });

    updateNavState();
    resetProgress();
    updateDurationLabel();
}

// Cache DOM reference for better performance
let cachedChatContainer = null;

// Get or cache the chat container
function getChatContainer() {
    if (!cachedChatContainer) {
        cachedChatContainer = document.getElementById('chatContainer');
    }
    return cachedChatContainer;
}

// Conversation lock to prevent multiple projects from mixing
let isConversationInProgress = false;
const messageTranslateOffset = 0.08 * window.innerWidth;
// let firstProjectShow = true;

// Updated projects structure with preview and full images
//project object: id, buttonImage, title, description, previewImages [], fullImages [], videos [], videoPosters [], audios, imageStyle, videoStyle, descriptionStyle, modelViewers[] (put attributes in a string).
//title has class .project-title
const projects = [
    [
        {
            id: 1,
            buttonImage: './Projects/ButtonImages/1.png',
            title: 'Deep DOF<br><span class="author-subtitle">By Dasul Kim</span>',
            description: '',
            descriptionStyle: '',
            imageStyle: '',
            videoStyle: '',
            previewImages: [],
            fullImages: [],
            videos: [],
            videoPosters: [],
            modelViewers: [],
            audios: []
        },
        {
            description: `I often feel as though I am not fully "present," as if I were a controllable avatar, a machine executing roles, or just an image on a screen.`,
            previewImages: ['./Projects/Dasul/ExhibitionDocu/exhibition_docu_compressed_1.webp'],
            fullImages: ['./Projects/Dasul/ExhibitionDocu/exhibition_docu_1.webp'],
        },
        {
            title: '<span class="project-subtitle">Latent Perception</span>',
            description: `The boundary between reality and disconnection from reality feels blurred, while my attachment to the digital realm feels oddly natural — as if I belong behind the screen, among renderers, algorithms, and pixels.`,
            videos: ['https://doubled.digital/media/Dasul/LatentPerception_Compressed.mp4'],
            videoPosters: ['./Projects/Dasul/LatentPerception_Poster.webp']
        },
        {
            description: `<em>Latent Perception</em> is a single-channel video work that reflects on digital familiarity and bodily alienation. It draws from my personal experience of derealization, connecting it to how screens mediate and simulate presence.<br><br>
            I explored the instability of identity and perception in digital space, shaped by feelings of derealization and disembodiment.`,
            // previewImages: ['./Projects/Dasul/ExhibitionDocu/exhibition_docu_compressed_2.webp'],
            // fullImages: ['./Projects/Dasul/ExhibitionDocu/exhibition_docu_2.webp']
        },
        {
            audios: ['./Projects/Dasul/Audios/sound1.mp3', './Projects/Dasul/Audios/sound2.mp3', './Projects/Dasul/Audios/sound3.mp3', './Projects/Dasul/Audios/sound4.mp3', './Projects/Dasul/Audios/sound5.mp3']
        },
        {
            description: `I structured this project around three conceptual motifs:<br><br>
            <strong>Deep depth of field</strong> — seeing both reality and virtuality with equal clarity.<br>
            <strong>Visual acuity tests</strong> — measuring how well we can focus in fragmented visual fields.<br>
            <strong>Diffusion models</strong> — rebuilding images from noise, echoing how perception reconstructs meaning.`
        },
        {
            title: '<span class="project-subtitle">E8 ∞ E8</span>',
            imageClass: 'after-title-media',
            previewImages: ['./Projects/Dasul/ExhibitionDocu/exhibition_docu_compressed_3.webp'],
            fullImages: ['./Projects/Dasul/ExhibitionDocu/exhibition_docu_3.webp']
        },
        {
            descriptionClass: "consecutive-start",
            description: `<em>E8 ∞ E8</em> visualizes a dataset of around 60 personal photographs. Each image is broken down into RGB color values and then restructured through layering, noise, and abstraction. The result is a cosmic, data-driven image field that evokes both machine vision and inner states.`,
            imageStyle: 'width: 75vw;',
            imageClass: 'consecutive-media',
            previewImages: ['./Projects/Dasul/Starlit/Starlit_Combined_Compressed_1.webp', './Projects/Dasul/Starlit/Starlit_Combined_Compressed_3.webp', './Projects/Dasul/E8E8/E8E8_Combined_Compressed.webp'],
            fullImages: ['./Projects/Dasul/Starlit/Starlit_Combined_1.webp', './Projects/Dasul/Starlit/Starlit_Combined_3.webp', './Projects/Dasul/E8E8/E8E8_Combined.webp']
        },
        {
            descriptionClass: 'consecutive-end',
            description: `Inspired by diffusion models, the process mimics how images emerge from noise, much like how memories and focus emerge in vision tests.`,
            videoStyle: 'width: 46vw;',
            videos: ['https://doubled.digital/media/Dasul/Constellations_Combined.mp4'],
            videoPosters: ['./Projects/Dasul/Constellations_Poster.webp']
        },
        {
            description: `Altogether, I question how personal identity and perception are reconfigured through data, representation, and algorithmic logic. I seek to understand the world not only through physical senses, but through computational and mediated perception.`,
            // imageStyle: 'width: 30vw;',
            // previewImages: ['./Projects/Dasul/ExhibitionDocu/exhibition_docu_4.webp'],
            // fullImages: ['./Projects/Dasul/ExhibitionDocu/exhibition_docu_4.webp']
        }
    ],
    [
        {
            id: 2,
            buttonImage: './Projects/ButtonImages/2.png',
            title: 'Manufacturing Consciousness<br><span class="author-subtitle">By Parag K. Mital</span>',
            description: ''
        },
        {
            description: `I place two AI-agent characters inside a digital simulation of the reclaimed site of Three Mile Island. Inspired by Herman and Chomsky’s <em>Manufacturing Consent</em>, I'm exploring how corporations quietly make us believe and accept their narratives.`
        },
        {
            description: `One avatar, driven by confident corporate optimism, celebrates technological progress and imagines a frictionless future, glossing over ethical and historical complexity. The other is set to counter with skepticism, grounding the conversation in history, existential awareness, and critical inquiry.`
        },
        {
            videos: ['https://doubled.digital/media/Parag/manufacturing-consciousness-pt2-Compressed.mp4'],
            videoPosters: ['./Projects/Parag/Manufacturing_Consciousness_Poster.webp']
        },
        {
            description: `I created this AI clash to push against our uncritical acceptance of corporate narratives, technological utopianism, and sanitized histories.`
        }
    ],
    [
        {
            id: 3,
            buttonImage: './Projects/ButtonImages/3.png',
            title: 'Juvenoia<br><span class="author-subtitle">By Michael Luo</span>',
            description: ''
        },
        {
            description: `I collected photos, memories, and made and scanned mini sculptures to build this live computer simulation of a Southwestern Chinese village that no longer exists. It mixes nostalgia with dreamlike distortions shaped by my complicated relationship with America.`
        },
        {
            description: `As an immigrant, parts of my history, language, and future felt overwritten in the process of belonging here. Looking back, this piece became an X-ray of my illness, my unnamed dread, my dear home crushed by Chinese hegemonic modernization, and my own alienation within American neoliberal life.`
        },
        {
            videos: ['https://doubled.digital/media/Michael/Juvenoia_11min_Compressed.mp4'],
            videoPosters: ['./Projects/Michael/Juvenoia_Poster.webp']
        },
        {
            description: `This system threads scenes and words through an unreliable algorithm—a fractured way of seeing memory, place, and self. <em>Juvenoia</em> lives in the limbo of it all, as do I.`
        }
    ],
    [
        {
            id: 4,
            buttonImage: './Projects/ButtonImages/4.png',
            title: 'Ghost Killing<br><span class="author-subtitle">By Hyun Cho</span>',
            description: ''
        },
        {
            description: `In this live simulation, I set up a power combat between battlefield drones and an AI-driven capitalistic platform. To put it simply, machine-learning-trained drones attack Amazon delivery vehicles, blocking them from ever completing their routes.`,
            videos: ['https://doubled.digital/media/Hyun/GhostKilling_main.mp4'],
            videoPosters: ['./Projects/Hyun/GhostKilling_main_Poster.webp']
        },
        {
            description: `When an Amazon truck reaches its destination, transcripts of cockpit and radio comms from a U.S. drone strike in Afghanistan are released.`,
            videos: ['https://doubled.digital/media/Hyun/GhostKilling_sub.mp4'],
            videoPosters: ['./Projects/Hyun/GhostKilling_sub_Poster.webp']
        },
        {
            description: `This uneasy parallel between automated warfare and automated labor control makes me think about how emerging automated systems reshape power among those with capital and technology and those without.`
        }
    ],
    [
        {
            id: 5,
            buttonImage: './Projects/ButtonImages/5.png',
            title: 'Opt-Out.IO<br><span class="author-subtitle">By Zhuoyu Zhang</span>',
            description: '',
        },
        {
            descriptionClass: "consecutive-start",
            description: `In folklore, meeting your doppelganger was an omen of death. Today, we are all on the path of having our own “doubles”, actively nourishing algorithmic versions of ourselves built from our data. I created this interactive visual novel that twists this modern reality into an uncanny thriller.`,
            imageClass: 'consecutive-media',
            previewImages: ['./Projects/Zhuoyu/trace_title_preview.webp'],
            fullImages: ['./Projects/Zhuoyu/trace_title.webp']
        },
        {
            descriptionClass: 'zhuoyu-link',
            description: '<a href="https://zxyzyy.itch.io/opt-outio" target="_blank">Enter <em>Opt-Out.IO</em></a>',
        },
        {
            descriptionClass: "consecutive-end",
            description: `You wake up as an amnesiac student, guided by a companion through simple digital tasks — checking notifications, filling surveys, confirming attendance — supposedly to recover your memory. But every choice is tracked and modeled, not to restore you, but to train your replacement. The “companion” becomes your optimized digital double, the version the system wants instead of you.`,
            previewImages: ['./Projects/Zhuoyu/trace_game1_preview.webp'],
            fullImages: ['./Projects/Zhuoyu/trace_game1.webp']
        },
        {
            description: `Choices in the game feel open, but the “string-of-pearls” design forces every path to converge, just like real platforms guiding us through preset funnels. As the interface breaks and glitches surface, the illusion collapses. The errors aren’t bugs; they reveal control. In those ruptures, I want you to feel the same quiet trap we live in online.`,
            imageStyle: 'width: 33vw;',
            previewImages: ['./Projects/Zhuoyu/trace_game2_preview.webp'],
            fullImages: ['./Projects/Zhuoyu/trace_game2.webp']
        }
    ],
    [
        {
            id: 6,
            buttonImage: './Projects/ButtonImages/6.png',
            title: 'Acts of Data<br><span class="author-subtitle">By Anže Sekelj</span>',
            description: '',
        },
        {
            description: `With my <em>Acts of Data</em> series, I investigate the speculative nature of generative AI. Using Generative Adversarial Networks (GANs), I explore how technology can reinterpret and reconstruct our data, archives, and histories.`,
            imageStyle: "width: 50vw;",
            previewImages: ['./Projects/Anze/exhibitionDocu/docu1_Compressed.webp'],
            fullImages: ['./Projects/Anze/exhibitionDocu/docu1.webp']
        },
        {
            title: '<span class="project-subtitle">Stones</span>',
            description: `I used the "Scan the World" dataset, a massive repository of 3D-scanned historical statues from the world's museums, and trained custom computer models, one on busts and one on full-figured statues, which can now independently generate entirely new figure sculptures.`,
            videos: ['https://doubled.digital/media/Anze/Stones/StoneVideo.mp4'],
            videoPosters: ['./Projects/Anze/Stones/StoneVid_Poster.webp']
        },
        {
            description: `By generating and 3D printing these new forms that may not have existed in reality, I think of and question how history is constructed. I want to open space for alternative perspectives and encourage viewers to think about the biased narratives that shape value and authenticity in art and history.`,
            modelViewers: ['src="./Projects/Anze/Stones/models/StoneCombined.glb" alt="Acts of Data: Stones - 3D Models" camera-controls touch-action="pan-y" autoplay auto-rotate ar ar-scale="fixed" xr-environment poster="./Projects/Anze/Stones/models/StonePoster.webp" shadow-intensity="1" camera-orbit="0deg 75deg 2.3m" max-camera-orbit="Infinity 160deg auto" min-camera-orbit="-Infinity 20deg 2.2m" style="width:18vw; height:70vh;"']
        },
        {
            title: '<span class="project-subtitle">Scapes</span>',
            descriptionClass: "consecutive-start",
            description: `The second project evolves directly from the first. I took the 2D texture files, or UV maps, from the AI-generated statues in <em>Stones</em> and reinterpret them as generative 3D landscapes. This new digital terrain symbolically represents the "collective body" of the sculptures created in the previous iteration.`
        },
        {
            videoClass: 'consecutive-media',
            videoStyle: 'width: 30vw',
            videos: ['https://doubled.digital/media/Anze/Scapes/Scapes1.mp4', 'https://doubled.digital/media/Anze/Scapes/Scapes2.mp4', 'https://doubled.digital/media/Anze/Scapes/Scapes3.mp4'],
            videoPosters: ['./Projects/Anze/Scapes/Scapes1_Poster.webp', './Projects/Anze/Scapes/Scapes2_Poster.webp', './Projects/Anze/Scapes/Scapes3_Poster.webp']
        },
        {
            descriptionClass: 'consecutive-end',
            description: `These landscapes are then subjected to the forces of sound. Drawing from the field of soundscape ecology, the project is presented as a three-video installation. Each video shows the landscape being visually "eroded" by machine learning processes, influenced by one of three distinct sound categories:<br><br>
            <strong>Biophony:</strong> Sounds created by living organisms.<br>
            <strong>Geophony:</strong> Non-biological sounds from the environment, like wind or water.<br>
            <strong>Anthrophony:</strong> Sounds caused by humans.<br>`,
            imageStyle: "width: 40vw;",
            previewImages: ['./Projects/Anze/exhibitionDocu/docu2_Compressed.webp'],
            fullImages: ['./Projects/Anze/exhibitionDocu/docu2.webp']
        },
        {
            description: `I managed to turn historical archives into generated 3D sculptures and sound-eroded landscapes to reflect on how data, technology, and soundscapes shape our physical and emotional world.`
        }
    ],
    [
        {
            id: 7,
            buttonImage: './Projects/ButtonImages/7.png',
            title: 'Cyborg T.A.R.O.T.<br><span class="author-subtitle">By Frédérick Maheux</span>',
            description: '',
        },
        {
            descriptionClass: 'consecutive-start',
            description: `Inspired by fortune telling machines like the Zoltan Prophetron, I created this interactive fortune-telling machine for the posthuman age.`,
            imageClass: 'consecutive-media',
            previewImages: ['./Projects/Frederick/tarot1.jpg'],
            fullImages: ['./Projects/Frederick/tarot1.jpg']
        },
        {
            descriptionClass: 'fred-link',
            description: '<a href="https://deathorgone.itch.io/cyborg-tarot" target="_blank">Enter <em>Cyborg T.A.R.O.T.</em></a>'
        },
        {
            descriptionClass: "consecutive-end",
            description: `Instead of treating tarot as fortune-telling, I use it as a cyborg guide that shows how bodies and technical systems amplify, contaminate, and change one another. The work overloads vision, layers imagery, and loops between custom AI models, which are trained on paper collages and the participant. I’m exploring tarot’s speculative potential in the sense proposed by the Italian techno-occult organization Gruppo di Nun: “Tarot makes manifest the idea that the cosmos is a cybernetic organism in continuous recombination.”`,
            previewImages: ['./Projects/Frederick/tarot2.jpg'],
            fullImages: ['./Projects/Frederick/tarot2.jpg']
        },
        {
            description: `The device is set up like an arcade machine in an enclosed space. When you step up, you get your own unique reading. You stand in front of the cameras, and slip your hand, inside a glove, into the controller.`
        },
        {
            description: `The system walks you through the Major Arcana as images, 3D structures, and glitchy narration shift and unravel. Then you’re pulled into the latent space, where you see your own face transforming in generative feedback loops.`
        }
    ],
    [
        {
            id: 8,
            buttonImage: './Projects/ButtonImages/8.png',
            title: 'Trace<br><span class="author-subtitle">By Minrui Qiao</span>',
            description: ''
        },
        {
            description: `Marshall McLuhan said “the medium is an extension of the human body,” and I think of it like a twin relationship — we learn from media, and media learns from us. With AI, that feels even truer. We’re in a hybrid loop now, where humans and machines feed into each other, shaping and co-generating meaning together.`,
            videos: ['https://doubled.digital/media/Minrui/trace_video.mp4'],
            videoPosters: ['./Projects/Minrui/trace_video_preview.webp']
        },
        {
            description: `In <em>TRACE</em>, your voice becomes the material. When you speak, your voice is captured and converted into raw token IDs, the fundamental language of generative AI. Those tokens then move through a physical loop: screen, printer, camera, speaker, and back to the mic. Each pass adds noise, so the signal folds, mutates, and drifts.`,
            videos: ['https://doubled.digital/media/Minrui/tokenflow.mp4'],
            videoPosters: ['./Projects/Minrui/tokenflow_preview.webp']
        },
        {
            description: `Inside that loop, you hear your own voice learning, glitching, and coming back changed, as if you and the machine are training each other in real time.`
        }
    ],
    [
        {
            id: 9,
            buttonImage: './Projects/ButtonImages/9.png',
            title: 'One Thousand and One Nights<br><span class="author-subtitle">By Sepideh Takshi</span>',
            description: ''
        },
        {
            description: `I’ve always been fascinated by One Thousand and One Nights and how Scheherazade used storytelling to survive. In this work, I reimagine that tradition as a living, global archive — rebuilt through algorithmic processes.`
        },
        {
            descriptionClass: 'consecutive-start',
            description: `So I made this web app as a digital double of the book. Users select emojis and a theme, from which an AI produces both a narrative and a visual response in the style of Persian miniature painting.`,
            imageClass: 'consecutive-media',
            previewImages: ['./Projects/Sepideh/oton_preview.webp'],
            fullImages: ['./Projects/Sepideh/oton.webp']
        },
        {
            descriptionClass: 'sepi-link',
            description: '<a href="https://one-thousand-one-nights-19.onrender.com/" target="_blank">Enter <em>One Thousand and One Nights</em></a>'
        },
        {
            descriptionClass: "consecutive-end",
            description: `Every participant becomes their own Scheherazade; the project becomes a polyphonic environment where stories proliferate endlessly, a fluid, living version of the original.`
        },
    ],
    [
        {
            id: 10,
            buttonImage: './Projects/ButtonImages/10.png',
            title: 'In Worlds<br><span class="author-subtitle">By Parag K. Mital</span>',
            description: ''
        },
        {
            description: `Through a real-time AI diffusion process to explore identity, I move through frames within frames in this video—seeing myself through a mirror, a sketchpad, my phone, Instagram, my monitor, and ultimately through my own shifting sense of self.`,
            videoStyle: 'width: 73vh;',
            videos: ['https://doubled.digital/media/Parag/in-worlds_Compressed.mp4'],
            videoPosters: ['./Projects/Parag/inWorlds_Poster.webp']
        },
        {
            description: `There’s even a brief moment where I appear projected into another gender. I was really experimenting here, letting the system question who I am while I question it back. I composed the music too, so the sound and images move and shift through that identity space together.`
        }
    ],
    [
        {
            id: 11,
            buttonImage: './Projects/ButtonImages/11.png',
            title: 'Decolonization Archive<br><span class="author-subtitle">By Sepideh Takshi</span>',
            // description: 'By Sepideh Takshi'
        },
        {
            description: `This simulation began with an ancient Urdu manuscript and a misrepresented insect in it—vividly drawn but only described as an unnamed “thing,” suspended between categories.`,
            previewImages: ['./Projects/Sepideh/decolonization_archive_preview.webp'],
            fullImages: ['./Projects/Sepideh/decolonization_archive.webp']
        },
        {
            description: `I built this in TouchDesigner with AI to bring the creature back as a moving image, paired with real-time generated text, and I used an AI model to overlay live, scientific text about butterflies directly onto the manuscript page.`,
            videos: ['https://doubled.digital/media/Sepideh/Decolonization_Archive.mp4'],
            videoPosters: ['./Projects/Sepideh/decolonization_vidPoster.webp']
        },
        {
            description: `I rebuilt the archive, leaving the butterfly between fact and folklore, pointing to colonial taxonomies and reanimating what was left uncertain. The archive becomes a living space instead of a fixed truth — where memory, power, and technology keep reshaping each other.`
        }
    ]
];

// Initialize buttons
function initializeButtons() {
    const buttonContainer = document.getElementById('buttonContainer');
    projects.forEach((projectEntries, index) => {
        if (!Array.isArray(projectEntries) || projectEntries.length === 0) {
            return;
        }

        const representativeEntry =
            projectEntries.find(entry => entry && typeof entry === 'object' && entry.buttonImage) ||
            projectEntries.find(entry => entry && typeof entry === 'object') ||
            null;

        if (!representativeEntry) {
            return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'project-button disabled';
        button.onclick = () => showProject(projectEntries);

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'project-button-content';
        const img = document.createElement('img');
        img.src = representativeEntry.buttonImage || '';

        const titleIsValid = typeof representativeEntry.title === 'string' && representativeEntry.title.trim() !== '';
        const fallbackAlt = representativeEntry.id !== undefined && representativeEntry.id !== null
            ? `Project ${representativeEntry.id}`
            : `Project ${index + 1}`;
        img.alt = titleIsValid ? representativeEntry.title : fallbackAlt;

        contentWrapper.appendChild(img);

        button.appendChild(contentWrapper);

        const buttonWrapper = document.createElement('div');
        buttonWrapper.className = 'button-wrapper';
        buttonWrapper.appendChild(button);

        buttonContainer.appendChild(buttonWrapper);

        requestAnimationFrame(() => {
            GlassSurfaceFX.attach({
                host: button,
                contentElement: contentWrapper,
                className: 'button-glass',
                options: { ...glassSurfaceSettings.projectButton }
            });
        });
    });
}

// Show project in chat with improved timing
async function showProject(projectEntries) {
    if (isConversationInProgress) {
        return;
    }

    if (!Array.isArray(projectEntries) || projectEntries.length === 0) {
        return;
    }

    const validEntries = projectEntries.filter(entry => entry && typeof entry === 'object');
    if (validEntries.length === 0) {
        return;
    }

    isConversationInProgress = true;

    mannualScrollOn = false;

    const buttons = document.querySelectorAll('.project-button');
    buttons.forEach(btn => btn.classList.add('disabled'));

    const chatContainer = getChatContainer();

    pauseCanvasDuringConversation();
    pauseAllManagedVideos();
    pauseAllManagedAudios();
    let resumeScheduled = false;
    const resumeAfterReveal = () => {
        if (!resumeScheduled) {
            resumeScheduled = true;
            resumeCanvasAfterConversation();
        }
    };

    try {
        requestAnimationFrame(() => {
            document.querySelectorAll('.message.bot').forEach(mb => {
                mb.style.transform = `translate3d(${getTranslationLimits(mb.firstElementChild, chatContainer, 'left') + messageTranslateOffset}px, 0, 0)`;
            });
            document.querySelectorAll('.message.user').forEach(mu => {
                mu.style.transform = `translate3d(${getTranslationLimits(mu.firstElementChild, chatContainer, 'right') - messageTranslateOffset}px, 0, 0)`;
            });
        });

        const sanitizeAttribute = (value) => {
            if (typeof value !== 'string') {
                return '';
            }
            return value
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        };

        const sanitizeModelViewerAttributes = (value) => {
            if (typeof value !== 'string') {
                return '';
            }
            return value
                .replace(/[\u0000-\u001F\u007F]/g, '')
                .replace(/[<>]/g, '')
                .trim();
        };

        const projectMessageContentElements = [];

        const representativeEntry = validEntries.find(entry => entry.buttonImage) || validEntries[0];
        if (representativeEntry) {
            const hasTitle = typeof representativeEntry.title === 'string' && representativeEntry.title.trim() !== '';
            const buttonAlt = hasTitle
                ? representativeEntry.title
                : (representativeEntry.id !== undefined && representativeEntry.id !== null
                    ? `Project ${representativeEntry.id}`
                    : 'Selected project');

            projectMessageContentElements.push(
                await addMessageWithParallelTiming(
                    'user',
                    'project-button',
                    `<img src="${representativeEntry.buttonImage || ''}" alt="${sanitizeAttribute(buttonAlt)}" loading="lazy" decoding="async">`
                )
            );
        }

        for (const entry of validEntries) {
            const entryHasTitle = typeof entry.title === 'string' && entry.title.trim() !== '';
            const descriptionStyleValue = typeof entry.descriptionStyle === 'string' ? entry.descriptionStyle.trim() : '';
            const descriptionClass = typeof entry.descriptionClass === 'string' ? entry.descriptionClass.trim() : '';
            const imageClass = typeof entry.imageClass === 'string' ? entry.imageClass.trim() : '';
            const videoClass = typeof entry.videoClass === 'string' ? entry.videoClass.trim() : '';
            const imageStyleValue = typeof entry.imageStyle === 'string' ? entry.imageStyle.trim() : '';
            const videoStyleValue = typeof entry.videoStyle === 'string' ? entry.videoStyle.trim() : '';
            const descriptionStyleAttr = descriptionStyleValue ? ` style="${sanitizeAttribute(descriptionStyleValue)}"` : '';
            const imageStyleAttr = imageStyleValue ? ` style="${sanitizeAttribute(imageStyleValue)}"` : '';
            const videoStyleAttr = videoStyleValue ? ` style="${sanitizeAttribute(videoStyleValue)}"` : '';

            if (entryHasTitle) {
                projectMessageContentElements.push(
                    await addMessageWithParallelTiming('bot', 'text', `<strong class="project-title">${entry.title}</strong>`)
                );
            }

            const entryHasDescription = typeof entry.description === 'string' && entry.description.trim() !== '';
            if (entryHasDescription) {
                projectMessageContentElements.push(
                    await addMessageWithParallelTiming('bot', 'text', `<span class="project-description ${descriptionClass}" ${descriptionStyleAttr}>${entry.description}</span>`)
                );
            }

            const previewImages = Array.isArray(entry.previewImages) ? entry.previewImages : [];
            const fullImages = Array.isArray(entry.fullImages) ? entry.fullImages : [];

            for (let i = 0; i < previewImages.length; i++) {
                const previewSrc = previewImages[i];
                const fullSrc = fullImages[i] || previewSrc;
                projectMessageContentElements.push(
                    await addMessageWithParallelTiming(
                        'bot',
                        'image',
                        `<img src="${previewSrc}" class="${imageClass}" alt="${sanitizeAttribute(entry.title || '')}"${imageStyleAttr} data-full-src="${fullSrc}" loading="lazy" decoding="async" onclick="openMediaOverlay('image', '${fullSrc}', event)">`
                    )
                );
            }

            const videos = Array.isArray(entry.videos) ? entry.videos : [];
            const videoPosters = Array.isArray(entry.videoPosters) ? entry.videoPosters : [];

            for (let i = 0; i < videos.length; i++) {
                const videoSrc = videos[i];
                const manualPoster = videoPosters[i];
                const poster = await ensureVideoPoster(videoSrc, manualPoster);
                const posterAttribute = poster ? ` poster="${poster}"` : '';
                projectMessageContentElements.push(
                    await addMessageWithParallelTiming(
                        'bot',
                        'video',
                        `<video src="${videoSrc}" class="${videoClass}" controls preload="metadata" playsinline${posterAttribute}${videoStyleAttr} onclick="openMediaOverlay('video', '${videoSrc}', event)"></video>`
                    )
                );
            }

            const modelViewerConfigs = Array.isArray(entry.modelViewers)
                ? entry.modelViewers
                : (typeof entry.modelViewer === 'string' && entry.modelViewer.trim() !== ''
                    ? [entry.modelViewer]
                    : []);

            for (const rawAttributes of modelViewerConfigs) {
                const sanitizedAttributes = sanitizeModelViewerAttributes(rawAttributes).trim();
                if (!sanitizedAttributes) {
                    continue;
                }
                projectMessageContentElements.push(
                    await addMessageWithParallelTiming(
                        'bot',
                        'model-viewer',
                        sanitizedAttributes
                    )
                );
            }

            const audios = Array.isArray(entry.audios) ? entry.audios : [];
            const validAudioSources = audios
                .map(src => (typeof src === 'string' ? src.trim() : ''))
                .filter(src => src.length > 0);

            if (validAudioSources.length > 0) {
                const sanitizedAudioSources = validAudioSources.map(src => sanitizeAttribute(src));
                const audioTracksAttr = sanitizeAttribute(JSON.stringify(validAudioSources));
                const initialAudioSrc = sanitizedAudioSources[0];
                const audioLabelSource = entryHasTitle ? `${entry.title} audio message` : 'Audio message';
                const safeAudioLabel = sanitizeAttribute(audioLabelSource || 'Audio message');
                const hasMultipleTracks = validAudioSources.length > 1;
                const navDisabledAttr = hasMultipleTracks ? '' : ' disabled';
                const audioMarkup = `
                    <div class="audio-message" tabindex="0" aria-label="${safeAudioLabel}" data-audio-index="0" data-audio-tracks="${audioTracksAttr}" data-audio-label="${safeAudioLabel}">
                        <button type="button" class="audio-nav audio-prev"${navDisabledAttr} aria-label="Previous audio message">⏮</button>
                        <button type="button" class="audio-button" aria-label="Play audio message">
                            <span class="audio-button-icon"></span>
                        </button>
                        <div class="audio-waveform">
                            <div class="audio-waveform-base"></div>
                            <div class="audio-waveform-progress"></div>
                        </div>
                        <button type="button" class="audio-nav audio-next"${navDisabledAttr} aria-label="Next audio message">⏭</button>
                        <span class="audio-duration">0:00</span>
                        <audio src="${initialAudioSrc}" preload="metadata"></audio>
                    </div>
                `;
                projectMessageContentElements.push(
                    await addMessageWithParallelTiming(
                        'bot',
                        'audio',
                        audioMarkup
                    )
                );
            }
        }

        requestAnimationFrame(() => {
            setTimeout(() => {
                document.querySelectorAll('.message.bot').forEach(mb => {
                    mb.style.transform = '';
                });
                document.querySelectorAll('.message.user').forEach(mu => {
                    mu.style.transform = '';
                });

                // setTimeout(()=>{
                    projectMessageContentElements.forEach(mc => {
                        const mci = mc.querySelector('.message-content-inner');
                        applyTemporaryWillChange(mci, ['filter', 'opacity']);
                        mc.classList.add('sent');
                        mci.style.filter = '';
                        mci.style.opacity = '';
                    });
                // }, 100);
                
                resumeAfterReveal();
            }, 1700);
        });
    } catch (error) {
        console.error('showProject failed:', error);
        resumeAfterReveal();
        throw error;
    } finally {
        isConversationInProgress = false;
        buttons.forEach(btn => btn.classList.remove('disabled'));
    }
}



function applyModelViewerAttributes(element, attributeString) {
    if (!element || typeof attributeString !== 'string') {
        return;
    }

    const attrPattern = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let match;

    while ((match = attrPattern.exec(attributeString)) !== null) {
        const name = match[1];
        if (!name) {
            continue;
        }

        const value = match[2] ?? match[3] ?? match[4];

        if (value === undefined) {
            element.setAttribute(name, '');
        } else {
            element.setAttribute(name, value);
        }
    }
}



// Enhanced message timing with preloading
async function addMessageWithParallelTiming(sender, type, content, welcome = false) {
    // Start typing indicator immediately
    if(welcome) showTypingIndicator(true);
    else showTypingIndicator();
    
    // Prepare the message element
    const message = document.createElement('div');
    message.className = `message ${sender} ${type}-wrapper`;

    // Create a promise that resolves after minimum typing duration
    let minTypingDuration;
    if(welcome) {
         minTypingDuration = delay(2000);
    }
    else minTypingDuration = delay(1600);
    
    const messageContent = document.createElement('div');
    messageContent.className = `message-content ${type}`;

    // Preload heavy assets while the typing animation runs
    if (type === 'image' || type === 'video' || type === 'audio') {
        preloadContent(type, content);
    }

    const messageContentInner = document.createElement('div');
    messageContentInner.className = 'message-content-inner';

    let inlineVideoElement = null;
    let inlineAudioContainer = null;

    if (type === 'model-viewer') {
        const modelViewerElement = document.createElement('model-viewer');
        applyModelViewerAttributes(modelViewerElement, content);
        messageContentInner.appendChild(modelViewerElement);
    } else {
        messageContentInner.innerHTML = content;
        inlineVideoElement = type === 'video' ? messageContentInner.querySelector('video') : null;
        inlineAudioContainer = type === 'audio' ? messageContentInner.querySelector('.audio-message') : null;
    }


    messageContent.appendChild(messageContentInner);
    
    //Set initial style for transition animation
    messageContent.style.opacity = '0';
    messageContent.style.transform = 'translate3d(0, -100vh, 0) scale3d(1.7,1,1)';
    if(type == 'text'){
        messageContentInner.style.filter = 'blur(5px)';
        messageContentInner.style.opacity = '0.5';
    }
    else {
        messageContentInner.style.filter = 'blur(12px)';
        messageContentInner.style.opacity = '0.75';
    }
    if(!welcome){
        if(sender == 'bot') message.style.transform = 'translate3d(-20vw, 0, 0)';
        else if(sender == 'user') message.style.transform = 'translate3d(20vw, 0, 0)';
    }

    message.appendChild(messageContent);
    
    // Wait for minimum typing duration AND preload to complete
    await minTypingDuration;
    // Now reveal the message with animation
    hideTypingIndicator();
    
    // Add to DOM (but invisible)
    const chatContainer = getChatContainer();
    const chatSpaceAfter = chatContainer.lastElementChild;
    chatContainer.insertBefore(message, chatSpaceAfter);

    const surfaceOptions = {
        ...glassSurfaceSettings.message.base
    };

    if ((type === 'image' || type === 'video') && glassSurfaceSettings.message.mediaOverrides) {
        Object.assign(surfaceOptions, glassSurfaceSettings.message.mediaOverrides);
    } else if (type === 'model-viewer' && glassSurfaceSettings.message.modelOverrides) {
        Object.assign(surfaceOptions, glassSurfaceSettings.message.modelOverrides);
    }

    const surfaceState = GlassSurfaceFX.attach({
        host: messageContent,
        contentElement: messageContentInner,
        className: 'message-glass',
        options: surfaceOptions
    });

    if (inlineVideoElement) {
        inlineVideoElement.playsInline = true;
        registerVideoElement(inlineVideoElement);
    }
    if (inlineAudioContainer) {
        registerAudioMessage(inlineAudioContainer);
    }

    //Wait glass effect ready promise resolve
    // if (surfaceState && surfaceState.readyPromise) {
    //    await surfaceState.readyPromise;
    // }
    
    //Make message appear
    requestAnimationFrame(() => {
        // Batch layout reads to keep reveal smooth
        messageContent.offsetHeight;
        messageContentInner.offsetHeight;

        let messageTransformTarget = null;
        
        if (messageTransformTarget !== null) {
            applyTemporaryWillChange(message, 'transform');
        }
        if (!welcome){
            if (sender == 'bot'){
                const translateX = getTranslationLimits(message.firstElementChild, chatContainer, 'left') + messageTranslateOffset;
                messageTransformTarget = `translate3d(${translateX}px, 0, 0)`;
            }
            else if (sender == 'user'){
                const translateX = getTranslationLimits(message.firstElementChild, chatContainer, 'right') - messageTranslateOffset;
                messageTransformTarget = `translate3d(${translateX}px, 0, 0)`;
            }
        }

        applyTemporaryWillChange(messageContent, ['opacity', 'transform']);
        

        if (messageTransformTarget !== null){
            message.style.transform = messageTransformTarget;
        }

        messageContent.style.opacity = '';
        messageContent.style.transform = '';
    });

    //Check if user triggered manual scroll
    if (!mannualScrollOn){
        requestAnimationFrame(() => {
            // Scroll 
            if(welcome){
                scrollToCenter(message);
                setTimeout(()=>{
                    messageContentInner.style.filter = '';
                    messageContentInner.style.opacity = '';
                }, 700)
                setTimeout(()=>{
                    messageContent.classList.add('sent');
                }, 1500);
            }
            else scrollToBottom();
        });
    }
    return messageContent;
}

// Typing indicator functions
function showTypingIndicator(welcome = false) {
    const indicator = document.getElementById('typingIndicator');
    if (!indicator) return;

    const chatContainer = getChatContainer();
    const chatSpaceAfter = chatContainer.lastElementChild;
    chatContainer.insertBefore(indicator, chatSpaceAfter);
    indicator.classList.add('active');

    // Apply glass surface effect to typing indicator
    const typingDots = indicator.querySelector('.typing-dots');
    if (typingDots) {
        GlassSurfaceFX.attach({
            host: typingDots,
            contentElement: typingDots.querySelector('.typing-dots-content'),
            className: 'typing-glass',
            options: { ...glassSurfaceSettings.typingIndicator }
        });
        // GlassSurfaceFX.forceRefresh(typingDots);

        typingDots.offsetHeight;
        typingDots.classList.add('active');
    }

    if (!mannualScrollOn){
        requestAnimationFrame(()=>{
            if(welcome) scrollToCenter(indicator);
            else {
                scrollToBottom();
            }              
        });
    }
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (!indicator) return;
    

    const typingDots = indicator.querySelector('.typing-dots');
    if (typingDots) {
        typingDots.classList.remove('active');
    }
    indicator.classList.remove('active');

    
}

// === ENHANCED MEDIA OVERLAY WITH ZOOM ===

let zoomAbortController = null;

// Zoom state variables
let zoomLevel = 1;
let zoomPanX = 0;
let zoomPanY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let lastPanX = 0;
let lastPanY = 0;
let activeDragPointerId = null;
let pendingZoomFrame = null;
let currentMediaElement = null;
let isDesktop = false;

function checkIfDesktop() {
    const canHover = window.matchMedia('(hover: hover)').matches;
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    const previousDesktop = isDesktop;

    if (canHover === true && hasFinePointer === true) {
        isDesktop = true;
    } else if (canHover === false && hasFinePointer === false) {
        isDesktop = false;
    } else {
        // Fallback for browsers without matchMedia or returning mixed results
        isDesktop = !('ontouchstart' in window) && navigator.maxTouchPoints === 0;
    }

    if (isDesktop !== previousDesktop || !rippleGridState.instance) {
        initOrUpdateRippleGrid();
    }
}

// Helper: pointer coords relative to OVERLAY CENTER (not top-left)
function getCenteredPointer(container, clientX, clientY) {
const rect = container.getBoundingClientRect();
return {
    x: clientX - (rect.left + rect.width / 2),
    y: clientY - (rect.top  + rect.height / 2),
};
}

// evt is optional so existing onclicks still work
async function openMediaOverlay(type, src, evt) {
    let sourceVideo = null;
    if (evt) {
        if (typeof evt.preventDefault === 'function') {
            evt.preventDefault();
        }
        if (typeof evt.stopPropagation === 'function') {
            evt.stopPropagation();
        }
        const target = evt.currentTarget || evt.target || null;
        if (target && target.tagName === 'VIDEO') {
            sourceVideo = target;
        }
    }

    if (sourceVideo && !sourceVideo.paused) {
        sourceVideo.pause();
    }

    const overlay = document.getElementById('mediaOverlay');
    const content = document.getElementById('overlayContent');
    const overlayContainer = overlay.querySelector('.media-overlay-content');
    const zoomControls = document.getElementById('zoomControls');

    const existingOverlayVideo = content.querySelector('video');
    if (existingOverlayVideo) {
        existingOverlayVideo.pause();
        deregisterVideoElement(existingOverlayVideo);
    }

    resetZoom(false); // Reset state without applying transform
    isDragging = false;
    activeDragPointerId = null;
    pauseAllManagedVideos();
    pauseAllManagedAudios();

    checkIfDesktop();

    if (type === 'image') {
        const img = new Image();
        img.decoding = 'async';
        img.src = src;
        img.alt = "Full size image";
        content.innerHTML = '';
        content.appendChild(img);
        currentMediaElement = img;
        img.style.willChange = 'transform';

        if (isDesktop) {
            overlayContainer.classList.add('zoom-enabled');
            zoomControls.classList.add('visible');
            
        } else {
            overlayContainer.classList.remove('zoom-enabled');
            zoomControls.classList.remove('visible');
        }

        let decoded = false;
        if (typeof img.decode === 'function') {
            try {
                await img.decode();
                decoded = true;
            } catch (err) {
                // Ignore decode errors; load listener will handle fallback
            }
        }

        if (!decoded) {
            await new Promise((resolve) => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
            });
        }

        if (isDesktop) {
            setupZoomHandlers(overlayContainer, img);
        }
    } else if (type === 'video') {
        content.innerHTML = `<video src="${src}" controls autoplay preload="metadata" playsinline></video>`;
        currentMediaElement = null;
        overlayContainer.classList.remove('zoom-enabled');
        zoomControls.classList.remove('visible');

        const overlayVideo = content.querySelector('video');
        if (overlayVideo) {
            overlayVideo.playsInline = true;
            registerVideoElement(overlayVideo);
            const playPromise = overlayVideo.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.catch(() => {});
            }
        }
    }

    overlay.classList.add('active');
    requestAnimationFrame(() => {
        GlassSurfaceFX.attach({
            host: zoomControls,
            contentElement: zoomControls,
            className: 'overlay-glass',
            options: { ...glassSurfaceSettings.zoomControls }
        });
        // GlassSurfaceFX.forceRefresh(zoomControls);
    });
}


function setupZoomHandlers(container, img) {
    if (zoomAbortController) zoomAbortController.abort();
    zoomAbortController = new AbortController();
    const { signal } = zoomAbortController;

    // --- Wheel zoom (keep cursor as focal point) ---
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const oldZoom = zoomLevel;
        const newZoom = Math.max(1, Math.min(5, zoomLevel * (1 - e.deltaY * 0.001)));

        const { x, y } = getCenteredPointer(container, e.clientX, e.clientY);

        // Keep the point under the cursor stationary
        zoomPanX = zoomPanX + (x - zoomPanX) * (1 - newZoom / oldZoom);
        zoomPanY = zoomPanY + (y - zoomPanY) * (1 - newZoom / oldZoom);
        zoomLevel = newZoom;

        if (zoomLevel <= 1.01) {
            resetZoom();
        } else {
            requestZoomUpdate(img);
        }
    }, { passive: false, signal });

    // --- Double-click to zoom (toggle between 1x and 2x at click point) ---
    // container.addEventListener('dblclick', (e) => {
    //     e.preventDefault();
    //     if (zoomLevel > 1) {
    //     resetZoom();
    //     } else {
    //     const oldZoom = zoomLevel;
    //     const newZoom = 2;
    //     const { x, y } = getCenteredPointer(container, e.clientX, e.clientY);

    //     zoomPanX = zoomPanX + (x - zoomPanX) * (1 - newZoom / oldZoom);
    //     zoomPanY = zoomPanY + (y - zoomPanY) * (1 - newZoom / oldZoom);
    //     zoomLevel = newZoom;
    //     applyZoom(img);
    //     }
    // }, { signal });

    // --- Drag to pan ---
    container.addEventListener('pointerdown', (e) => startDrag(e, container), { signal });
    container.addEventListener('pointermove', handleDrag, { signal });
    container.addEventListener('pointerup', endDrag, { signal });
    container.addEventListener('pointercancel', endDrag, { signal });
}


function startDrag(e, container) {
    if (!isDesktop || !currentMediaElement) return;

    const target = e.target;
    if (target && target.closest && target.closest('.zoom-controls')) return;
    if (target !== currentMediaElement) return;
    if (zoomLevel <= 1 || (e.button !== undefined && e.button !== 0)) return;
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;

    e.preventDefault();
    isDragging = true;

    const pointerId = typeof e.pointerId === 'number' ? e.pointerId : null;
    activeDragPointerId = pointerId;
    if (pointerId !== null && typeof container.setPointerCapture === 'function') {
        container.setPointerCapture(pointerId);
    }

    dragStartX = e.clientX;
    dragStartY = e.clientY;
    lastPanX = zoomPanX;
    lastPanY = zoomPanY;
    container.classList.add('dragging'); // CSS will disable transition while dragging
}

function handleDrag(e) {
    if (!isDragging || !currentMediaElement) return;
    if (activeDragPointerId !== null && typeof e.pointerId === 'number' && e.pointerId !== activeDragPointerId) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    zoomPanX = lastPanX + dx;
    zoomPanY = lastPanY + dy;

    requestZoomUpdate(currentMediaElement);
}


function endDrag(e) {
    if (!isDragging) return;
    if (e && activeDragPointerId !== null && typeof e.pointerId === 'number' && e.pointerId !== activeDragPointerId) return;
    isDragging = false;
    const container = document.querySelector('.media-overlay-content');
    if (container && activeDragPointerId !== null && typeof container.releasePointerCapture === 'function') {
        if (!container.hasPointerCapture || container.hasPointerCapture(activeDragPointerId)) {
            container.releasePointerCapture(activeDragPointerId);
        }
    }
    activeDragPointerId = null;
    if (container) container.classList.remove('dragging');
}


function constrainPan(img) {
    if (!img) return;
    const container = img.closest('.media-overlay-content') || img.parentElement?.parentElement;
    if (!container) return;

    // The image's displayed size after scaling
    const scaledWidth = img.clientWidth * zoomLevel;
    const scaledHeight = img.clientHeight * zoomLevel;

    // How much the image overhangs the container on each side
    const overhangX = Math.max(0, (scaledWidth - container.clientWidth) / 2);
    const overhangY = Math.max(0, (scaledHeight - container.clientHeight) / 2);

    // Limit the pan to the overhang values
    zoomPanX = Math.max(-overhangX, Math.min(overhangX, zoomPanX));
    zoomPanY = Math.max(-overhangY, Math.min(overhangY, zoomPanY));
}

// Apply current zoom & pan
function applyZoom(img) {
    constrainPan(img);
    img.style.transformOrigin = 'center center';
    img.style.transform = `translate3d(${zoomPanX}px, ${zoomPanY}px, 0) scale(${zoomLevel})`;
}

function requestZoomUpdate(img = currentMediaElement) {
    if (!img) return;
    if (pendingZoomFrame !== null) return;
    pendingZoomFrame = requestAnimationFrame(() => {
        pendingZoomFrame = null;
        applyZoom(img);
    });
}

// Zoom control buttons (center is 0,0 in centered coords)
function zoomIn() {
    if (!currentMediaElement || !isDesktop) return;
    const oldZoom = zoomLevel;
    const newZoom = Math.min(5, zoomLevel + 0.5);
    const x = 0, y = 0;

    zoomPanX = zoomPanX + (x - zoomPanX) * (1 - newZoom / oldZoom);
    zoomPanY = zoomPanY + (y - zoomPanY) * (1 - newZoom / oldZoom);
    zoomLevel = newZoom;

    if (zoomLevel <= 1.01) {
        resetZoom();
    } else {
        requestZoomUpdate(currentMediaElement);
    }
}

function zoomOut() {
    if (!currentMediaElement || !isDesktop) return;
    const oldZoom = zoomLevel;
    const newZoom = Math.max(1, zoomLevel - 0.5);
    const x = 0, y = 0;

    zoomPanX = zoomPanX + (x - zoomPanX) * (1 - newZoom / oldZoom);
    zoomPanY = zoomPanY + (y - zoomPanY) * (1 - newZoom / oldZoom);
    zoomLevel = newZoom;

    if (zoomLevel <= 1.01) {
        resetZoom();
    } else {
        requestZoomUpdate(currentMediaElement);
    }
}

function resetZoom(apply = true) {
    zoomLevel = 1;
    zoomPanX = 0;
    zoomPanY = 0;
    if (pendingZoomFrame !== null) {
        cancelAnimationFrame(pendingZoomFrame);
        pendingZoomFrame = null;
    }
    if (apply && currentMediaElement) {
        currentMediaElement.style.transformOrigin = 'center center';
        currentMediaElement.style.transform = 'translate3d(0, 0, 0) scale(1)';
    }
}

function closeMediaOverlay() {
    const overlay = document.getElementById('mediaOverlay');
    if (!overlay) return;

    const overlayContainer = overlay.querySelector('.media-overlay-content');
    pauseAllManagedAudios();

    // Abort zoom handlers
    if (zoomAbortController) {
        zoomAbortController.abort();
        zoomAbortController = null;
    }

    if (overlayContainer && activeDragPointerId !== null && typeof overlayContainer.releasePointerCapture === 'function') {
        if (!overlayContainer.hasPointerCapture || overlayContainer.hasPointerCapture(activeDragPointerId)) {
            overlayContainer.releasePointerCapture(activeDragPointerId);
        }
    }


    const overlayContentEl = document.getElementById('overlayContent');
    const overlayVideo = overlayContentEl ? overlayContentEl.querySelector('video') : null;
    if (overlayVideo) {
        overlayVideo.pause();
        deregisterVideoElement(overlayVideo);
    }
    isDragging = false;
    activeDragPointerId = null;

    if (currentMediaElement) {
        currentMediaElement.style.willChange = '';
    }
    resetZoom(false);
    currentMediaElement = null;

    overlay.classList.add('closing');

    setTimeout(() => {
        overlay.classList.remove('active', 'closing');
        document.getElementById('overlayContent').innerHTML = '';

        const container = overlay.querySelector('.media-overlay-content');
        if (container) container.classList.remove('zoom-enabled', 'dragging');

        document.getElementById('zoomControls').classList.remove('visible');
    }, 400);
}


// === (end of enhanced media overlay with zoom) ===


// === UNITILITY FUNCTIONS === 
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const temporaryWillChangeMap = new WeakMap();

function parseTimeToMs(timeString) {
    if (!timeString) return 0;
    return timeString.split(',').reduce((max, part) => {
        const value = part.trim();
        if (!value) return max;
        const number = parseFloat(value);
        if (Number.isNaN(number)) return max;
        if (value.endsWith('ms')) return Math.max(max, number);
        if (value.endsWith('s')) return Math.max(max, number * 1000);
        return Math.max(max, number);
    }, 0);
}

function getMaxTransitionTime(element) {
    if (!element) return 0;
    const styles = window.getComputedStyle(element);
    const durations = styles.transitionDuration ? styles.transitionDuration.split(',') : [];
    const delays = styles.transitionDelay ? styles.transitionDelay.split(',') : [];
    if (!durations.length) return 0;
    return durations.reduce((max, duration, index) => {
        const total = parseTimeToMs(duration) + parseTimeToMs(delays[index] || delays[delays.length - 1] || '0s');
        return Math.max(max, total);
    }, 0);
}

function getMaxAnimationTime(element) {
    if (!element) return 0;
    const styles = window.getComputedStyle(element);
    const durations = styles.animationDuration ? styles.animationDuration.split(',') : [];
    const delays = styles.animationDelay ? styles.animationDelay.split(',') : [];
    if (!durations.length) return 0;
    return durations.reduce((max, duration, index) => {
        const total = parseTimeToMs(duration) + parseTimeToMs(delays[index] || delays[delays.length - 1] || '0s');
        return Math.max(max, total);
    }, 0);
}

function applyTemporaryWillChange(element, properties) {
    if (!element) return;

    const propertyList = Array.isArray(properties) ? properties.filter(Boolean) : [properties];
    const props = propertyList.filter(Boolean).join(', ');
    if (!props) return;

    const existing = temporaryWillChangeMap.get(element);
    if (existing) {
        element.removeEventListener('transitionend', existing.onTransitionEnd);
        element.removeEventListener('animationend', existing.onAnimationEnd);
        clearTimeout(existing.timeoutId);
        temporaryWillChangeMap.delete(element);
    }

    element.style.willChange = props;

    const cleanup = () => {
        const state = temporaryWillChangeMap.get(element);
        if (!state) return;
        if (element.style.willChange === state.props) {
            element.style.willChange = '';
        }
        element.removeEventListener('transitionend', state.onTransitionEnd);
        element.removeEventListener('animationend', state.onAnimationEnd);
        clearTimeout(state.timeoutId);
        temporaryWillChangeMap.delete(element);
    };

    const onTransitionEnd = (event) => {
        if (event.target === element) {
            cleanup();
        }
    };

    const onAnimationEnd = (event) => {
        if (event.target === element) {
            cleanup();
        }
    };

    const fallbackDuration = Math.max(
        getMaxTransitionTime(element),
        getMaxAnimationTime(element)
    ) || 600;

    const timeoutId = setTimeout(cleanup, fallbackDuration + 50);

    const state = { props, timeoutId, onTransitionEnd, onAnimationEnd };
    temporaryWillChangeMap.set(element, state);

    element.addEventListener('transitionend', onTransitionEnd);
    element.addEventListener('animationend', onAnimationEnd);
}


function getTranslationLimits(childElement, parentElement, direction) {
    // Get the dimensions and position of the parent and child elements
    // relative to the viewport.
    const parentRect = parentElement.getBoundingClientRect();
    const childRect = childElement.getBoundingClientRect();
    let parentPadding = parseFloat(window.getComputedStyle(parentElement).paddingLeft);

    let maxTranslate = 0;
    // To move LEFT:
    // The child's right edge must align with the parent's left edge.
    // The distance needed to move is parentRect.left - childRect.left.
    // This will be a negative value, suitable for translateX.
    if (direction == 'left') {maxTranslate = parentRect.left - (childElement.offsetLeft + childElement.offsetParent.offsetLeft);}

    // To move RIGHT:
    // The child's left edge must align with the parent's right edge.
    // The distance needed to move is parentRect.right - childRect.right.
    // This will be a positive value.
    if (direction == 'right') {maxTranslate = parentRect.right - (childElement.offsetLeft + childElement.offsetWidth + childElement.offsetParent.offsetLeft + parentPadding);}

    return maxTranslate;
}

// === ADAPTIVE QUALITY MANAGEMENT ===
function enterRecoveryMode(now = performance.now()) {
    if (qualityState.mode === 'recovery') return;

    qualityState.mode = 'recovery';
    qualityState.qualityMultiplier = 0.8;
    qualityState.lastSwitch = now;
    GlassSurfaceFX.refreshAll();

    if (Array.isArray(letters) && letters.length > 0) {
        letters = letters.slice(-190);
    }

    document.dispatchEvent(new CustomEvent('qualitychange', { detail: { mode: qualityState.mode } }));

    console.log('[quality] recovery mode');
}

function enterHighMode(now = performance.now()) {
    if (qualityState.mode === 'high') return;

    qualityState.mode = 'high';
    qualityState.qualityMultiplier = 1;
    qualityState.lastSwitch = now;
    GlassSurfaceFX.refreshAll();

    document.dispatchEvent(new CustomEvent('qualitychange', { detail: { mode: qualityState.mode } }));

    console.log('[quality] high mode');
}

function monitorPerformance(now) {
    const timestamp = typeof now === 'number' ? now : performance.now();
    const delta = timestamp - lastFpsSampleTime;
    lastFpsSampleTime = timestamp;

    if (delta > 0 && delta < 250) {
        fpsSamples.push(delta);
        fpsSum += delta;
        if (fpsSamples.length > MAX_FPS_SAMPLES) {
            fpsSum -= fpsSamples.shift();
        }

        const averageDelta = fpsSum / fpsSamples.length;
        const fps = 1000 / averageDelta;

        if (qualityState.mode === 'high') {
            if (fps < QUALITY_THRESHOLDS.dropFps) {
                if (lowFpsSince === null) {
                    lowFpsSince = timestamp;
                } else if (timestamp - lowFpsSince >= QUALITY_THRESHOLDS.dropDuration) {
                    enterRecoveryMode(timestamp);
                    lowFpsSince = null;
                }
            } else {
                lowFpsSince = null;
            }
            highFpsSince = null;
        } else {
            if (fps > QUALITY_THRESHOLDS.raiseFps) {
                if (highFpsSince === null) {
                    highFpsSince = timestamp;
                } else if (timestamp - highFpsSince >= QUALITY_THRESHOLDS.raiseDuration) {
                    enterHighMode(timestamp);
                    highFpsSince = null;
                }
            } else {
                highFpsSince = null;
            }
            lowFpsSince = null;
        }
    }

    requestAnimationFrame(monitorPerformance);
}

requestAnimationFrame(monitorPerformance);

document.addEventListener('qualitychange', () => {
    if (bgCanvas && bgCtx) {
        resizeCanvas(true);
    }

    GlassSurfaceFX.refreshAll();
});

// ============ IMPROVED SCROLLING FUNCTIONS WITH LERP ============

// Scroll animation state
let scrollAnimationId = null;
let currentScrollTarget = null;
let mannualScrollOn = false;

// Linear interpolation function
function lerp(start, end, factor) {
    return start + (end - start) * factor;
}

// Smooth scroll animation using requestAnimationFrame
function animateScroll(container, targetPosition) {
    // Cancel any existing scroll animation
    if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId);
        scrollAnimationId = null;
    }

    // Round target position to avoid sub-pixel rendering
    currentScrollTarget = Math.floor(targetPosition);
    
    const lerpFactor = 0.06; // Adjust this for scroll speed (0.05 = slow, 0.2 = fast)
    const closeEnoughThreshold = 5; // Stop when close enough
    const minimumMovement = 1; // Skip movements smaller than this
    
    function step() {
        // Get current position
        const currentPosition = container.scrollTop;
        const distance = Math.abs(currentScrollTarget - currentPosition);
        
        // Check if we're close enough to the target
        if (distance < closeEnoughThreshold) {
            // Snap (or no snap) to exact target and stop animation
            // container.scrollTop = currentScrollTarget;
            scrollAnimationId = null;
            currentTarget = null;
        } 
        else {
            // Calculate new position using lerp
            const newPosition = lerp(currentPosition, currentScrollTarget, lerpFactor);
            const movement = Math.abs(newPosition - currentPosition);

            // Only update if movement is significant enough
            if (movement > minimumMovement) {
                // Round to avoid sub-pixel rendering
                container.scrollTop = Math.ceil(newPosition);
                scrollAnimationId = requestAnimationFrame(step);
            }
            else{
                scrollAnimationId = null;
                currentTarget = null;
            }
        }
    }
    // Start the animation
    scrollAnimationId = requestAnimationFrame(step);
}

function scrollToBottom() {
    const chatContainer = getChatContainer();
    
    // Get current scroll position
    let currentScrollTop = chatContainer.scrollTop;
    
    // Calculate the maximum scrollTop value (the very bottom)
    let maxScrollTop = chatContainer.scrollHeight - chatContainer.clientHeight;
    
    // Calculate the desired offset in pixels (50vh)
    const offset = Math.round(0.5 * window.innerHeight);
    
    // Subtract the offset from the maximum scroll position
    let scrollTopTarget = maxScrollTop - offset;

        // Use Math.max to ensure the target isn't a negative number and make sure it never scroll up
    scrollTopTarget = Math.max(currentScrollTop, scrollTopTarget);

    // But also don't exceed the maximum possible scroll
    scrollTopTarget = Math.min(scrollTopTarget, maxScrollTop);
    
    // Only animate if there's actually a change needed
    if (Math.abs(scrollTopTarget - currentScrollTop) > 0) {
        animateScroll(chatContainer, scrollTopTarget);
    }
}

// Scroll to center a specific element
function scrollToCenter(element) {
    const chatContainer = getChatContainer();
    
    // Use cached container dimensions when possible
    // const containerRect = chatContainer.getBoundingClientRect();
    // const elementRect = element.getBoundingClientRect();

    // Calculate the element's position relative to the container
    const elementTop = element.offsetTop;
    const elementHeight = element.offsetHeight;
    
    // Get container styles only once
    const containerComputedStyle = window.getComputedStyle(chatContainer);
    const containerPaddingTop = parseFloat(containerComputedStyle.paddingTop);
    const containerPaddingBottom = parseFloat(containerComputedStyle.paddingBottom);
    const containerHeight = chatContainer.offsetHeight - containerPaddingTop - containerPaddingBottom;
    
    // Calculate scroll position to center the element
    const scrollTopTarget = elementTop + (elementHeight / 2) - (containerHeight / 2);

    // Start smooth scroll animation
    animateScroll(chatContainer, scrollTopTarget+12);
}

function cancelScrollAnimation() {
    if (scrollAnimationId) {
        mannualScrollOn = true;
        cancelAnimationFrame(scrollAnimationId);
        scrollAnimationId = null;
    }
}

// Close overlay on background click
// document.getElementById('mediaOverlay').addEventListener('click', function(e) {
//     if (e.target === this) {
//         closeMediaOverlay();
//     }
// });
// Clicks inside the content should NOT close:
// document.getElementById('overlayContent').addEventListener('click', (e) => e.stopPropagation());


//Listen for custom ready event for webgl and canvas
window.whenEffectsReady().then(({ canvas, webgl }) => {
    console.log('Both canvases effects ready');
    document.querySelector('.loading-screen').classList.add('loaded');
});

//listen for likely hardware acceleration off
document.addEventListener('hardwareaccelerationdisabled', () => {
  // Drop features, show a warning, etc.
  console.log("Hardware acceleration likely be off.")
  const notifyContainer = document.querySelector('.notification-container');
  if(!notifyContainer.classList.contains('on')){
    notifyContainer.classList.add('on');
  }
  document.querySelector('.notification-text').innerHTML += "Turn on hardware acceleration in browser settings for smoother viewing.&nbsp"
});

// Initialize on load
window.onload = () => {
    initCanvas();
    initializeButtons();

    // Check if desktop on load
    checkIfDesktop();
    initOrUpdateRippleGrid();
    
    // Update desktop check on resize
    window.addEventListener('resize', checkIfDesktop, { passive: true });

    //Notice if mobile or if no gpu acceleration
    const notifyContainer = document.querySelector('.notification-container');
    if (!isDesktop){
        if(!notifyContainer.classList.contains('on')){
            notifyContainer.classList.add('on');
        }
        document.querySelector('.notification-text').innerHTML += 'View on computer for best experience.&nbsp'
    }
    notifyContainer.addEventListener('click', (e)=>{
        e.target.classList.remove('on');
        e.target.classList.add('off');
    });
    

    // Welcome message with new timing
    setTimeout(async () => {
        await addMessageWithParallelTiming('bot', 'text', '<span class="welcome-title">Digital Double</span><br><span class="welcome-subtitle">Pavilion of <em>The Wrong Biennale</em></span>', true);
        const buttons = document.querySelectorAll('.project-button');
        buttons.forEach(btn => btn.classList.remove('disabled'));

        //Add manual scroll listener after welcome message
        const chatContainer = getChatContainer();
        // Detect mouse wheel scrolling
        chatContainer.addEventListener('wheel', cancelScrollAnimation, { passive: true });

        // Detect touch scrolling
        chatContainer.addEventListener('touchmove', cancelScrollAnimation, { passive: true });

        // Detect keyboard scrolling
        document.addEventListener('keydown', (e) => {
            // Only cancel if the chat container is the scroll target or contains the focused element
            const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
            if (scrollKeys.includes(e.key)) {
                cancelScrollAnimation();
            }
        }, { passive: true });
    }, 500);
};

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    destroyRippleGrid();
    stopCanvasAnimation();
    pauseAllManagedVideos();
    pauseAllManagedAudios();
    if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId);
    }
});
