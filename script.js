(() => {

    const starField = document.getElementById('starfield-stars');
    if (!starField) {
        return;
    }

    const STAR_COUNT = 90;
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < STAR_COUNT; i += 1) {
        const star = document.createElement('span');
        star.className = 'star';

        const size = (1 + Math.random() * 2).toFixed(2);
        const top = (Math.random() * 100).toFixed(2);
        const left = (Math.random() * 100).toFixed(2);
        const minOpacity = (0.12 + Math.random() * 0.06).toFixed(2);
        const maxOpacity = (0.22 + Math.random() * 0.08).toFixed(2);
        const duration = (4 + Math.random() * 6).toFixed(2);
        const delay = (-Math.random() * 10).toFixed(2);

        star.style.setProperty('--star-size', `${size}px`);
        star.style.setProperty('--star-top', `${top}%`);
        star.style.setProperty('--star-left', `${left}%`);
        star.style.setProperty('--star-min', minOpacity);
        star.style.setProperty('--star-max', maxOpacity);
        star.style.setProperty('--star-duration', `${duration}s`);
        star.style.setProperty('--star-delay', `${delay}s`);

        fragment.appendChild(star);
    }

    starField.appendChild(fragment);

})();

(async () => {

    const backgroundFog = document.querySelector('.background-fog');
    if (backgroundFog) {
        const setFogPlaybackRate = () => {
            backgroundFog.defaultPlaybackRate = 0.6;
            backgroundFog.playbackRate = 0.6;
        };
        backgroundFog.addEventListener('loadedmetadata', setFogPlaybackRate);
        backgroundFog.addEventListener('play', setFogPlaybackRate);
        setFogPlaybackRate();
    }

    const coverElement = document.querySelector('.music-player__cover');

    const coverArt = document.querySelector('.music-player__cover-art');

    const trackTitle = document.querySelector('.music-player__track-title .music-player__title-ink');

    const trackArtist = document.querySelector('.music-player__track-artist');

    const equalizer = document.querySelector('.music-player__eq');

    const eqBars = equalizer?.querySelectorAll('.music-player__eq-bar') ?? [];

    const shuffleButton = document.querySelector('.music-player__control--shuffle');

    const loopButton = document.querySelector('.music-player__control--loop');

    const previousButton = document.querySelector('.music-player__control--previous');

    const nextButton = document.querySelector('.music-player__control--next');

    const playPauseButton = document.querySelector('.music-player__control--play-pause');

    const soundButton = document.querySelector('.music-player__control--sound');

    const volumeInput = document.querySelector('.music-player__volume-input');

    const volumeFill = document.querySelector('.music-player__volume-fill');

    const progressRow = document.querySelector('.music-player__progress');

    const progressRail = document.querySelector('.music-player__progress-rail');

    const seekFill = document.querySelector('.music-player__progress-fill');

    const progressThumb = document.querySelector('.music-player__progress-thumb');

    const currentTimeLabel = document.querySelector('.music-player__progress-time--current');

    const durationLabel = document.querySelector('.music-player__progress-time--duration');

    const volumeRailEl = document.querySelector('.music-player__volume-rail');


    if (!coverElement || !coverArt || !trackTitle || !trackArtist || !equalizer) {
        return;
    }


    let tracks = [];

    try {
        const response = await fetch('tracklist.json');

        if (!response.ok) {
            throw new Error(`Failed to load tracklist.json (${response.status})`);
        }

        const data = await response.json();

        tracks = (data.tracks ?? []).map((track, index) => ({
            title: track.name,
            artist: track.artist,
            coverSrc: `images/${track.image}`,
            coverAlt: `Album artwork ${index + 1}`,
            audioSrc: `audio/${track.audio ?? `Track-${index + 1}.mp3`}`,
            duration: Number(track.duration) || 0,
        }));
    } catch (error) {
        console.error('The Arcane Archive: could not load tracklist.json', error);
        return;
    }

    if (tracks.length === 0) {
        return;
    }


    const coverVariants = tracks.map((_, index) => `music-player__cover--${index + 1}`);


    const audio = new Audio();
    audio.preload = 'metadata';


    const BAR_COUNT = eqBars.length;

    let audioContext = null;
    let analyser = null;
    let sourceNode = null;
    let freqData = null;
    let barBands = null;
    let rafId = null;

    const buildBarBands = (barCount, sampleRate, fftSize) => {
        const nyquist = sampleRate / 2;
        const minFreq = 30;
        const maxFreq = Math.min(14000, nyquist);
        const binCount = fftSize / 2;
        const bands = [];

        for (let i = 0; i < barCount; i += 1) {
            const t0 = i / barCount;
            const t1 = (i + 1) / barCount;
            const f0 = minFreq * (maxFreq / minFreq) ** t0;
            const f1 = minFreq * (maxFreq / minFreq) ** t1;

            let startBin = Math.floor((f0 / nyquist) * binCount);
            let endBin = Math.ceil((f1 / nyquist) * binCount);

            startBin = Math.max(0, Math.min(startBin, binCount - 1));
            endBin = Math.max(startBin + 1, Math.min(endBin, binCount));

            bands.push([startBin, endBin]);
        }

        return bands;
    };

    const ensureAudioGraph = () => {
        if (analyser || audioContext) {
            return;
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
            return;
        }

        try {
            audioContext = new AudioContextClass();
            sourceNode = audioContext.createMediaElementSource(audio);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0.82;

            sourceNode.connect(analyser);
            analyser.connect(audioContext.destination);

            freqData = new Uint8Array(analyser.frequencyBinCount);
            barBands = buildBarBands(BAR_COUNT, audioContext.sampleRate, analyser.fftSize);
        } catch (error) {
            console.warn('The Arcane Archive: live audio visualization unavailable', error);
            analyser = null;
            audioContext = null;
        }
    };

    const renderBars = () => {
        if (!analyser || !freqData || !barBands) {
            return;
        }

        analyser.getByteFrequencyData(freqData);

        barBands.forEach(([start, end], index) => {
            const bar = eqBars[index];

            if (!bar) {
                return;
            }

            let sum = 0;

            for (let bin = start; bin < end; bin += 1) {
                sum += freqData[bin];
            }

            const average = sum / (end - start);
            const normalized = average / 255;
            const scale = Math.min(1, Math.max(0.08, normalized ** 0.65));

            bar.style.transform = `scaleY(${scale.toFixed(3)})`;
            bar.style.opacity = (0.55 + scale * 0.45).toFixed(3);
        });

        rafId = requestAnimationFrame(renderBars);
    };

    const startVisualizer = () => {
        if (rafId) {
            return;
        }

        rafId = requestAnimationFrame(renderBars);
    };

    const stopVisualizer = () => {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    };

    const resetVisualizerBars = () => {
        eqBars.forEach((bar) => {
            bar.style.removeProperty('transform');
            bar.style.removeProperty('opacity');
        });
    };


    let activeIndex = 0;

    let volumeLevel = 0.5;

    let volumeBeforeMute = 0.5;

    let isMuted = false;

    let shuffleOn = false;

    let loopOn = false;

    let currentDuration = 0;


    const formatTime = (totalSeconds) => {
        const safeSeconds = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0;
        const minutes = Math.floor(safeSeconds / 60);
        const seconds = Math.floor(safeSeconds % 60);

        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };


    const updateDurationUI = () => {
        if (durationLabel) {
            durationLabel.textContent = formatTime(currentDuration);
        }
    };


    const updateProgressUI = (time) => {
        const clamped = currentDuration > 0 ? Math.min(Math.max(time, 0), currentDuration) : Math.max(time, 0);
        const percent = currentDuration > 0 ? (clamped / currentDuration) * 100 : 0;
        const boundedPercent = Math.min(100, Math.max(0, percent));

        if (currentTimeLabel) {
            currentTimeLabel.textContent = formatTime(clamped);
        }

        if (seekFill) {
            seekFill.style.width = `${boundedPercent}%`;
        }

        if (progressThumb) {
            progressThumb.style.left = `${boundedPercent}%`;
        }

        if (progressRail) {
            progressRail.setAttribute('aria-valuenow', String(Math.round(boundedPercent)));
            progressRail.setAttribute('aria-valuetext', `${formatTime(clamped)} of ${formatTime(currentDuration)}`);
        }
    };


    const alignProgressRow = () => {
        if (!progressRow || !shuffleButton || !volumeRailEl) {
            return;
        }

        const rowRect = progressRow.getBoundingClientRect();
        const shuffleRect = shuffleButton.getBoundingClientRect();
        const volumeRect = volumeRailEl.getBoundingClientRect();

        if (rowRect.width === 0) {
            return;
        }

        const startOffset = Math.max(0, shuffleRect.left - rowRect.left);
        const endOffset = Math.max(0, rowRect.right - volumeRect.right);

        progressRow.style.setProperty('--progress-edge-start', `${startOffset}px`);
        progressRow.style.setProperty('--progress-edge-end', `${endOffset}px`);
    };

    const scheduleAlignProgressRow = () => {
        requestAnimationFrame(alignProgressRow);
    };

    const playerScaleHost = document.querySelector('.music-player-scale-host');
    const playerRoot = document.querySelector('.music-player');
    const MOBILE_LAYOUT_MAX_WIDTH = 768;
    const PLAYER_DESIGN_WIDTH_PX = 545;
    const MOBILE_VIEWPORT_INSET_PX = 20;

    let playerNaturalHeightPx = 0;

    const readPlayerNaturalHeight = () => {
        if (!playerRoot) {
            return 0;
        }

        const scale = parseFloat(playerRoot.style.getPropertyValue('--player-scale'))
            || parseFloat(getComputedStyle(playerRoot).zoom)
            || 1;
        const safeScale = scale > 0 ? scale : 1;

        return playerRoot.getBoundingClientRect().height / safeScale;
    };

    const measurePlayerNaturalHeight = () => {
        if (!playerRoot) {
            return 0;
        }

        if (playerNaturalHeightPx > 0) {
            return playerNaturalHeightPx;
        }

        const height = readPlayerNaturalHeight();
        playerNaturalHeightPx = height > 0 ? height : playerNaturalHeightPx;
        return playerNaturalHeightPx;
    };

    const invalidatePlayerNaturalHeight = () => {
        playerNaturalHeightPx = 0;
    };

    const applyMobilePlayerScale = () => {
        if (!playerScaleHost || !playerRoot) {
            return;
        }

        if (window.innerWidth > MOBILE_LAYOUT_MAX_WIDTH) {
            playerRoot.style.removeProperty('--player-scale');
            invalidatePlayerNaturalHeight();
            return;
        }

        const naturalHeight = playerNaturalHeightPx || measurePlayerNaturalHeight();
        if (!naturalHeight) {
            return;
        }

        const scaleW = (window.innerWidth - MOBILE_VIEWPORT_INSET_PX * 2) / PLAYER_DESIGN_WIDTH_PX;
        const scaleH = (window.innerHeight - MOBILE_VIEWPORT_INSET_PX * 2) / naturalHeight;
        const scale = Math.min(scaleW, scaleH, 1);

        playerRoot.style.setProperty('--player-scale', String(scale));
    };

    const scheduleMobilePlayerScale = () => {
        requestAnimationFrame(() => {
            applyMobilePlayerScale();
            scheduleAlignProgressRow();
        });
    };

    const scheduleMobilePlayerScaleAfterLayout = () => {
        invalidatePlayerNaturalHeight();
        scheduleMobilePlayerScale();
    };


    const applyTrack = (index) => {
        const track = tracks[index];

        coverArt.src = track.coverSrc;
        coverArt.alt = track.coverAlt;
        trackTitle.textContent = track.title;
        trackArtist.textContent = track.artist;

        coverElement.classList.remove(...coverVariants);
        coverElement.classList.add(`music-player__cover--${index + 1}`);

        audio.src = track.audioSrc;

        currentDuration = track.duration || 0;
        updateDurationUI();
        updateProgressUI(0);
        scheduleAlignProgressRow();
    };


    const restartEqAnimation = () => {
        eqBars.forEach((bar) => {
            bar.style.animation = 'none';
            void bar.offsetHeight;
            bar.style.removeProperty('animation');
        });
    };


    const setEqState = (state) => {
        equalizer.dataset.eq = state;
    };

    const triggerFallbackPlayingAnimation = () => {
        const previous = equalizer.dataset.eq;
        setEqState('playing');

        if (previous === 'idle') {
            restartEqAnimation();
        }
    };


    const setPlaybackState = (isPlaying) => {
        if (!playPauseButton) {
            return;
        }

        playPauseButton.dataset.playback = isPlaying ? 'playing' : 'paused';
        playPauseButton.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    };


    const setSoundState = (isOn) => {
        if (!soundButton) {
            return;
        }

        soundButton.dataset.sound = isOn ? 'on' : 'off';
        soundButton.setAttribute('aria-label', isOn ? 'Mute' : 'Unmute');
    };


    const syncVolumeUI = () => {
        const audible = !isMuted && volumeLevel > 0;
        const sliderValue = Math.round(volumeLevel * 100);

        if (volumeFill) {
            volumeFill.style.width = `${sliderValue}%`;
        }

        if (volumeInput) {
            volumeInput.value = String(sliderValue);
            volumeInput.setAttribute('aria-valuenow', String(sliderValue));
        }

        setSoundState(audible);
    };


    const applyVolumeToAudio = () => {
        audio.volume = volumeLevel;
        audio.muted = isMuted || volumeLevel === 0;
    };


    const setToggleState = (button, isOn, labelOn, labelOff) => {
        if (!button) {
            return;
        }

        button.setAttribute('aria-pressed', String(isOn));
        button.setAttribute('aria-label', isOn ? labelOn : labelOff);
    };


    const playCurrentTrack = () => {
        ensureAudioGraph();

        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }

        audio.play().catch((error) => {
            console.warn('The Arcane Archive: playback was prevented', error);
        });
    };


    const goToTrack = (index, { autoplay = false } = {}) => {
        activeIndex = (index + tracks.length) % tracks.length;
        applyTrack(activeIndex);

        if (autoplay) {
            playCurrentTrack();
        }
    };


    const getNextIndex = () => {
        if (shuffleOn && tracks.length > 1) {
            let nextIndex = activeIndex;

            while (nextIndex === activeIndex) {
                nextIndex = Math.floor(Math.random() * tracks.length);
            }

            return nextIndex;
        }

        return (activeIndex + 1) % tracks.length;
    };


    const getPreviousIndex = () => {
        if (shuffleOn && tracks.length > 1) {
            let previousIndex = activeIndex;

            while (previousIndex === activeIndex) {
                previousIndex = Math.floor(Math.random() * tracks.length);
            }

            return previousIndex;
        }

        return (activeIndex - 1 + tracks.length) % tracks.length;
    };


    shuffleButton?.addEventListener('click', () => {
        shuffleOn = !shuffleOn;
        setToggleState(shuffleButton, shuffleOn, 'Shuffle on', 'Shuffle off');
    });


    loopButton?.addEventListener('click', () => {
        loopOn = !loopOn;
        audio.loop = loopOn;
        setToggleState(loopButton, loopOn, 'Loop on', 'Loop off');
    });


    previousButton?.addEventListener('click', () => {
        goToTrack(getPreviousIndex(), { autoplay: true });
    });


    nextButton?.addEventListener('click', () => {
        goToTrack(getNextIndex(), { autoplay: true });
    });


    playPauseButton?.addEventListener('click', () => {
        if (audio.paused) {
            playCurrentTrack();
        } else {
            audio.pause();
        }
    });


    soundButton?.addEventListener('click', () => {
        if (isMuted) {
            isMuted = false;

            if (volumeLevel === 0) {
                volumeLevel = volumeBeforeMute > 0 ? volumeBeforeMute : 0.5;
            }
        } else {
            volumeBeforeMute = volumeLevel > 0 ? volumeLevel : volumeBeforeMute;
            isMuted = true;
        }

        applyVolumeToAudio();
        syncVolumeUI();
    });


    volumeInput?.addEventListener('input', () => {
        volumeLevel = Number(volumeInput.value) / 100;

        if (volumeLevel > 0) {
            volumeBeforeMute = volumeLevel;
            isMuted = false;
        } else {
            isMuted = true;
        }

        applyVolumeToAudio();
        syncVolumeUI();
    });


    audio.addEventListener('play', () => {
        setPlaybackState(true);

        if (analyser) {
            setEqState('live');
            startVisualizer();
        } else {
            triggerFallbackPlayingAnimation();
        }
    });

    audio.addEventListener('pause', () => {
        setPlaybackState(false);

        if (analyser) {
            stopVisualizer();
        }

        if (equalizer.dataset.eq !== 'idle') {
            resetVisualizerBars();
            setEqState('paused');
        }
    });

    audio.addEventListener('ended', () => {
        goToTrack(getNextIndex(), { autoplay: true });
    });

    audio.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
            currentDuration = audio.duration;
            updateDurationUI();
            updateProgressUI(audio.currentTime);
        }
    });

    audio.addEventListener('timeupdate', () => {
        updateProgressUI(audio.currentTime);
    });

    audio.addEventListener('error', () => {
        console.error('The Arcane Archive: failed to load audio for track', tracks[activeIndex]);
    });


    applyTrack(activeIndex);
    audio.loop = loopOn;
    applyVolumeToAudio();
    resetVisualizerBars();
    setEqState('idle');
    setPlaybackState(false);
    setToggleState(shuffleButton, shuffleOn, 'Shuffle on', 'Shuffle off');
    setToggleState(loopButton, loopOn, 'Loop on', 'Loop off');
    syncVolumeUI();

    window.addEventListener('resize', scheduleMobilePlayerScale);
    document.fonts?.ready?.then(scheduleMobilePlayerScaleAfterLayout).catch(() => {});
    coverArt?.addEventListener('load', scheduleMobilePlayerScale);
    scheduleMobilePlayerScaleAfterLayout();

})();
