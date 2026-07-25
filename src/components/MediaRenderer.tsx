import React, { useState, useEffect, useRef } from 'react';

export interface MediaInfo {
  isVideo: boolean;
  type: 'image' | 'direct_video' | 'youtube' | 'google_drive' | 'google_photos';
  embedUrl?: string;
  directUrl?: string;
  videoId?: string;
}

export function getMediaEmbedInfo(url?: string): MediaInfo {
  if (!url) return { isVideo: false, type: 'image', directUrl: '' };

  const trimmed = url.trim();

  // 1. YouTube Watch / Shorts / Share link
  if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
    let videoId = '';
    if (trimmed.includes('youtu.be/')) {
      videoId = trimmed.split('youtu.be/')[1]?.split('?')[0]?.split('&')[0];
    } else if (trimmed.includes('youtube.com/watch')) {
      const urlParams = new URLSearchParams(trimmed.split('?')[1] || '');
      videoId = urlParams.get('v') || '';
    } else if (trimmed.includes('youtube.com/shorts/')) {
      videoId = trimmed.split('youtube.com/shorts/')[1]?.split('?')[0]?.split('&')[0];
    }

    if (videoId) {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      return {
        isVideo: true,
        type: 'youtube',
        videoId,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&loop=0&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&fs=0&autohide=1&enablejsapi=1&playsinline=1&widget_referrer=${encodeURIComponent(origin)}&origin=${encodeURIComponent(origin)}`,
      };
    }
  }

  // 2. Google Drive video or view link
  if (trimmed.includes('drive.google.com')) {
    const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const fileId = match[1];
      return {
        isVideo: true,
        type: 'google_drive',
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        directUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
      };
    }
  }

  // 3. Google Photos link
  if (trimmed.includes('photos.google.com')) {
    return {
      isVideo: true,
      type: 'google_photos',
      embedUrl: trimmed,
      directUrl: trimmed,
    };
  }

  // 4. Standard video extensions or keywords
  const lower = trimmed.toLowerCase();
  const isVideoExt =
    lower.endsWith('.mp4') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.ogg') ||
    lower.endsWith('.mov') ||
    lower.includes('video') ||
    lower.includes('mp4') ||
    lower.includes('stream');

  if (isVideoExt) {
    return {
      isVideo: true,
      type: 'direct_video',
      directUrl: trimmed,
    };
  }

  // 5. Standard image
  return {
    isVideo: false,
    type: 'image',
    directUrl: trimmed,
  };
}

interface MediaRendererProps {
  src: string;
  alt?: string;
  className?: string;
  isVideo?: boolean;
  isActive?: boolean;
  shouldPlay?: boolean;
  onVideoEnded?: () => void;
  onVideoDuration?: (durationSeconds: number) => void;
}

export const MediaRenderer: React.FC<MediaRendererProps> = ({
  src,
  alt = '',
  className = '',
  isVideo,
  isActive = true,
  shouldPlay,
  onVideoEnded,
  onVideoDuration,
}) => {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const info = getMediaEmbedInfo(src);
  const showVideo = isVideo || info.isVideo;

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const canPlay = shouldPlay !== undefined ? shouldPlay : isActive;

  useEffect(() => {
    setIframeLoaded(false);
  }, [src]);

  // Handle play/pause/seek behavior when canPlay or active status changes
  useEffect(() => {
    if (!showVideo) return;

    if (info.type === 'youtube' && iframeRef.current?.contentWindow) {
      try {
        if (canPlay) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
            '*'
          );
        } else {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
            '*'
          );
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'seekTo', args: [0, true] }),
            '*'
          );
        }
      } catch (err) {
        // ignore
      }
    }

    if (videoRef.current) {
      try {
        if (canPlay) {
          videoRef.current.play().catch(() => {});
        } else {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      } catch (err) {
        // ignore
      }
    }
  }, [canPlay, showVideo, info.type]);

  // Listen to postMessage from YouTube iframe (enablejsapi=1)
  useEffect(() => {
    if (!showVideo || !isActive || info.type !== 'youtube') return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.event === 'onStateChange' && data?.info === 0) {
          onVideoEnded?.();
        }
        if (data?.event === 'infoDelivery') {
          if (data?.info?.playerState === 0) {
            onVideoEnded?.();
          }
          if (data?.info?.duration && typeof data.info.duration === 'number') {
            onVideoDuration?.(data.info.duration);
          }
        }
      } catch (err) {
        // ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [showVideo, isActive, info.type, onVideoEnded, onVideoDuration]);

  const handleIframeLoad = () => {
    // Delay setting iframeLoaded briefly so initial YouTube overlay fades out while preloaded
    setTimeout(() => {
      setIframeLoaded(true);
    }, 1000);
  };

  if (showVideo) {
    if (info.type === 'youtube') {
      if (isMobile && info.videoId) {
        return (
          <div className={`relative overflow-hidden w-full h-full bg-zinc-950 flex items-center justify-center ${className}`}>
            <img
              src={`https://img.youtube.com/vi/${info.videoId}/hqdefault.jpg`}
              alt={alt || 'Vídeo da galeria'}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
          </div>
        );
      }

      return (
        <div className={`relative overflow-hidden w-full h-full bg-zinc-950 flex items-center justify-center ${className}`}>
          {/* Scaled & Cropped YouTube iframe to completely crop out YouTube title bar, channel info, and overlays */}
          <iframe
            ref={iframeRef}
            key={`yt-${src}`}
            src={info.embedUrl}
            title={alt || 'Vídeo da galeria'}
            onLoad={handleIframeLoad}
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] max-w-none border-0 pointer-events-none object-cover transition-opacity duration-700 ${
              iframeLoaded && isActive ? 'opacity-100' : 'opacity-0'
            }`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />

          {/* Shield Overlay preventing clicks/taps from reaching YouTube iframe controls */}
          <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
        </div>
      );
    }

    if (info.type === 'google_drive') {
      return (
        <div className={`relative overflow-hidden w-full h-full bg-zinc-950 flex items-center justify-center ${className}`}>
          <iframe
            src={info.embedUrl}
            title={alt || 'Vídeo da galeria'}
            onLoad={() => setIframeLoaded(true)}
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[160%] max-w-none border-0 pointer-events-none object-cover transition-opacity duration-700 ${
              iframeLoaded && isActive ? 'opacity-100' : 'opacity-0'
            }`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
          <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
        </div>
      );
    }

    // Direct MP4 / WebM video: 100% clean HTML5 video player without branding or controls
    return (
      <div className={`relative overflow-hidden w-full h-full bg-zinc-950 ${className}`}>
        <video
          ref={videoRef}
          src={info.directUrl || src}
          autoPlay={isActive}
          loop={false}
          muted
          playsInline
          className="w-full h-full object-cover pointer-events-none"
          onLoadedMetadata={(e) => {
            const dur = e.currentTarget.duration;
            if (dur && !isNaN(dur) && dur > 0) {
              onVideoDuration?.(dur);
            }
          }}
          onEnded={() => {
            if (isActive) {
              onVideoEnded?.();
            }
          }}
        />
        <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      className={className}
      onError={(e) => {
        e.currentTarget.src =
          'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80';
      }}
    />
  );
};


