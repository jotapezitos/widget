import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, Sparkles, Star, Scissors, Flame, Zap, CheckCircle, ArrowRight, Play, Pause, Heart, MessageCircle, Send, ShieldCheck, Disc } from 'lucide-react';
import { db, doc, collection, onSnapshot } from '../lib/firebase';
import { GallerySettings, StorySlide, Service, Barber } from '../types';
import { DEFAULT_GALLERY_SETTINGS, DEFAULT_SERVICES } from '../data/initialData';
import { MediaRenderer, getMediaEmbedInfo } from './MediaRenderer';

interface HeroProps {
  onOpenBookingModal: (service?: Service, barber?: Barber) => void;
  onViewServices: () => void;
}

interface FloatingHeart {
  id: number;
  leftPercent: number;
  sizePx: number;
  rotDeg: number;
  driftPx: number;
  colorClass: string;
}

export const Hero: React.FC<HeroProps> = ({ onOpenBookingModal, onViewServices }) => {
  const [isPlayingMusic, setIsPlayingMusic] = useState<boolean>(false);
  const [quickStyle, setQuickStyle] = useState<string>('degrade_risco');
  const [currentStoryIndex, setCurrentStoryIndex] = useState<number>(0);
  const [isStoryPaused, setIsStoryPaused] = useState<boolean>(false);
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const [storyLiked, setStoryLiked] = useState<boolean>(false);
  const likeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);

  // Live gallery settings from Firestore
  const [gallerySettings, setGallerySettings] = useState<GallerySettings>(DEFAULT_GALLERY_SETTINGS);
  const [allServices, setAllServices] = useState<Service[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pressStartTimeRef = useRef<number>(0);

  useEffect(() => {
    // Listen for real-time updates to gallery settings
    const unsub = onSnapshot(doc(db, 'settings', 'gallery'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as GallerySettings;
        if (data && data.stories && data.stories.length > 0) {
          setGallerySettings(data);
        }
      }
    }, (error) => {
      console.log('Using default gallery settings:', error);
    });

    // Stream services for 1-Click quick booking box
    const unsubServices = onSnapshot(collection(db, 'services'), (snap) => {
      const list: Service[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Service, 'id'>),
      }));
      if (list.length > 0) {
        setAllServices(list);
      }
    }, (error) => {
      console.log('Using default services:', error);
    });

    return () => {
      unsub();
      unsubServices();
    };
  }, []);

  const featuredServices = useMemo(() => {
    let sourceList = allServices.length > 0
      ? allServices
      : DEFAULT_SERVICES.map((s, i) => ({ id: `default-${i}`, ...s }));

    const explicitFeatured = sourceList.filter((s) => s.isFeatured);
    if (explicitFeatured.length >= 1) {
      return explicitFeatured.slice(0, 3);
    }
    return sourceList.slice(0, 3);
  }, [allServices]);

  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const rawStories: StorySlide[] = gallerySettings.stories && gallerySettings.stories.length > 0
    ? gallerySettings.stories
    : DEFAULT_GALLERY_SETTINGS.stories;

  const stories: StorySlide[] = useMemo(() => {
    if (isMobile) {
      const filtered = rawStories.filter((s) => !s.isVideo && !getMediaEmbedInfo(s.image).isVideo);
      return filtered.length > 0 ? filtered : rawStories;
    }
    return rawStories;
  }, [gallerySettings.stories, isMobile]);

  const username = gallerySettings.username || DEFAULT_GALLERY_SETTINGS.username;
  const avatarUrl = gallerySettings.avatarUrl || DEFAULT_GALLERY_SETTINGS.avatarUrl;

  const activeStoryIndex = currentStoryIndex < stories.length ? currentStoryIndex : 0;
  const activeStory = stories[activeStoryIndex] || stories[0];

  const [detectedVideoDuration, setDetectedVideoDuration] = useState<number | null>(null);

  // Reset detected duration when active story changes
  useEffect(() => {
    setDetectedVideoDuration(null);
  }, [activeStoryIndex]);

  const isCurrentVideo = Boolean(activeStory?.isVideo) || getMediaEmbedInfo(activeStory?.image).isVideo;

  // Calculate slide duration according to exact rule:
  // Standard image duration = 5000ms (5s)
  // Max video duration limit = 10000ms (10s, 2x image time limit)
  // If video duration < 10s, slide duration matches actual video duration (e.g. 6s)
  // If video duration > 10s, capped at 10000ms (10s cut-off)
  let currentSlideDuration = 5000;
  if (isCurrentVideo) {
    if (detectedVideoDuration && detectedVideoDuration > 0) {
      currentSlideDuration = Math.max(2000, Math.min(detectedVideoDuration * 1000, 10000));
    } else {
      currentSlideDuration = 10000;
    }
  }

  // Auto-advance story timer based on calculated slide duration using setTimeout
  useEffect(() => {
    if (isStoryPaused || isHolding) return;

    const timer = setTimeout(() => {
      setCurrentStoryIndex((prev) => (prev + 1) % stories.length);
    }, currentSlideDuration);

    return () => clearTimeout(timer);
  }, [isStoryPaused, isHolding, currentSlideDuration, activeStoryIndex, stories.length]);

  const handleVideoEnded = () => {
    setCurrentStoryIndex((prev) => (prev + 1) % stories.length);
  };

  const handleVideoDuration = (durationSec: number) => {
    setDetectedVideoDuration(durationSec);
  };

  const handleNextStory = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentStoryIndex((prev) => (prev + 1) % stories.length);
  };

  const handlePrevStory = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentStoryIndex((prev) => (prev - 1 + stories.length) % stories.length);
  };

  const handlePointerDown = () => {
    pressStartTimeRef.current = Date.now();
    setIsHolding(true);
  };

  const handlePointerUp = (isLeftSide: boolean) => {
    setIsHolding(false);
    const holdDuration = Date.now() - pressStartTimeRef.current;
    if (holdDuration < 220) {
      if (isLeftSide) {
        handlePrevStory();
      } else {
        handleNextStory();
      }
    }
  };

  const triggerHeartReaction = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStoryLiked(true);

    if (likeTimeoutRef.current) {
      clearTimeout(likeTimeoutRef.current);
    }
    likeTimeoutRef.current = setTimeout(() => {
      setStoryLiked(false);
    }, 500);

    const singleHeart: FloatingHeart = {
      id: Date.now() + Math.random(),
      leftPercent: 82 + Math.random() * 10, // Position near the heart button on the right
      sizePx: Math.floor(20 + Math.random() * 12), // Size variation between 20px and 32px
      rotDeg: Math.floor(-15 + Math.random() * 30), // Slight tilt between -15° and +15° (always upright)
      driftPx: Math.floor(-45 + Math.random() * 90), // Unique drift trajectory for every click
      colorClass: 'text-rose-500 fill-rose-500 drop-shadow-md', // Consistent vibrant red/rose color
    };

    setFloatingHearts((prev) => [...prev, singleHeart]);

    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== singleHeart.id));
    }, 1600);
  };

  const renderCtaIcon = (iconName?: string) => {
    switch (iconName) {
      case 'scissors':
        return <Scissors className="w-4 h-4" />;
      case 'sparkles':
        return <Sparkles className="w-4 h-4" />;
      case 'flame':
        return <Flame className="w-4 h-4" />;
      case 'zap':
        return <Zap className="w-4 h-4" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (isPlayingMusic) {
      audioRef.current.pause();
      setIsPlayingMusic(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlayingMusic(true);
      }).catch((err) => {
        console.log('Audio playback status:', err);
        setIsPlayingMusic(true);
      });
    }
  };

  const styleOptions = [
    { id: 'degrade_risco', name: 'Degradê Navalhado + Risco', price: 50, tag: 'MAIS PEDIDO' },
    { id: 'platinado', name: 'Corte + Platinado', price: 150, tag: 'ESPECIAL' },
    { id: 'combo', name: 'Cabelo + Barba', price: 65, tag: 'COMPLETO' },
  ];

  return (
    <div className="relative overflow-hidden bg-white text-zinc-900 border-b border-zinc-200 bg-street-grid">
      {/* Hidden Audio Stream for Street FM */}
      <audio
        ref={audioRef}
        loop
        preload="auto"
        src="https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3"
      />
      
      {/* CROSSED CAUTION TAPES (CRIME SCENE STATIC TAPE BEHIND + ANIMATED YELLOW TICKER ON TOP) */}
      <div className="relative w-full py-5 sm:py-7 overflow-hidden select-none bg-white">
        
        {/* TAPE 1 (BEHIND): ANIMATED CRIME SCENE STRIPED HAZARD TAPE MOVING LEFT TO RIGHT */}
        <div className="absolute inset-x-[-8%] top-1/2 -translate-y-1/2 -rotate-2 sm:-rotate-1.5 z-0 pointer-events-none overflow-hidden">
          <div className="h-7 sm:h-8 w-[116%] animate-stripes-right border-y-2 border-black shadow-[0px_4px_10px_rgba(0,0,0,0.25)]" />
        </div>

        {/* TAPE 2 (ON TOP): ANIMATED SOLID YELLOW TICKER MARQUEE */}
        <div className="relative z-10 w-[116%] -ml-[8%] rotate-2 sm:rotate-1.5 border-y-2 border-black bg-amber-400 py-1.5 sm:py-2 shadow-[0px_6px_12px_rgba(0,0,0,0.3)] flex items-center overflow-hidden">
          <div className="animate-marquee whitespace-nowrap flex items-center gap-6 font-bebas text-sm sm:text-base tracking-widest uppercase font-black text-black">
            <span className="flex items-center gap-1.5"><Flame className="w-4 h-4 fill-black text-black" /> CORTES MODERNOS & ESTILO EXCLUSIVO</span>
            <span className="text-black font-black text-sm font-mono">//</span>
            <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 fill-black text-black" /> DEGRADÊ NAVALHADO DE PRECISÃO</span>
            <span className="text-black font-black text-sm font-mono">//</span>
            <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4 fill-black text-black" /> PIGMENTAÇÃO & PLATINADO</span>
            <span className="text-black font-black text-sm font-mono">//</span>
            <span className="flex items-center gap-1.5"><Disc className="w-4 h-4 text-black" /> ATENDIMENTO VIP COM HORA MARCADA</span>
            <span className="text-black font-black text-sm font-mono">//</span>
            <span className="flex items-center gap-1.5"><Scissors className="w-4 h-4 text-black" /> BARBOTERAPIA & RISCO NA SOBRANCELHA</span>
            <span className="text-black font-black text-sm font-mono">//</span>
            {/* Repeat set for continuous marquee */}
            <span className="flex items-center gap-1.5"><Flame className="w-4 h-4 fill-black text-black" /> CORTES MODERNOS & ESTILO EXCLUSIVO</span>
            <span className="text-black font-black text-sm font-mono">//</span>
            <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 fill-black text-black" /> DEGRADÊ NAVALHADO DE PRECISÃO</span>
            <span className="text-black font-black text-sm font-mono">//</span>
            <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4 fill-black text-black" /> PIGMENTAÇÃO & PLATINADO</span>
            <span className="text-black font-black text-sm font-mono">//</span>
            <span className="flex items-center gap-1.5"><Disc className="w-4 h-4 text-black" /> ATENDIMENTO VIP COM HORA MARCADA</span>
            <span className="text-black font-black text-sm font-mono">//</span>
            <span className="flex items-center gap-1.5"><Scissors className="w-4 h-4 text-black" /> BARBOTERAPIA & RISCO NA SOBRANCELHA</span>
          </div>
        </div>

      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start relative z-10">
        
        {/* Left Column Text & CTAs */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="flex flex-wrap items-center gap-2.5 mt-1 sm:-mt-2 lg:-mt-7 mb-4 lg:mb-6">
            <span className="px-3.5 py-1 rounded-xl bg-amber-400 text-black border-2 border-black font-bebas text-xs sm:text-sm font-bold uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              #narégua
            </span>

            <span className="px-3 py-1 rounded-xl bg-red-600 text-white border-2 border-black font-bebas text-xs sm:text-sm font-bold uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              #nevou
            </span>

            <span className="px-3 py-1 rounded-xl bg-blue-600 text-white border-2 border-black font-bebas text-xs sm:text-sm font-bold uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5">
              #nãoficaurso
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-bebas tracking-wider uppercase text-black dark:text-white leading-[0.95] flex flex-col items-start gap-2 sm:gap-3">
              <span>AGENDE AÍ PRA</span>
              <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                <span className="bg-black text-amber-400 dark:bg-white dark:text-black px-3.5 py-1.5 rounded-lg inline-block border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                  NÃO FICAR URSO
                </span>
              </div>
            </h1>
          </div>

          <p className="text-base sm:text-lg text-zinc-700 max-w-2xl leading-relaxed font-medium">
            Corte alinhado na régua, fade de altíssima precisão e atendimento pontual sem fila. Escolha seu barbeiro de confiança e agende seu horário em segundos direto pelo celular.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <button
              onClick={() => onOpenBookingModal()}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-black text-base uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center gap-3 font-bebas text-2xl"
            >
              <Calendar className="w-6 h-6" />
              Marcar Horário
            </button>

            <button
              onClick={onViewServices}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-black hover:bg-zinc-800 text-white border-2 border-black font-extrabold text-sm transition-all flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] font-bebas text-lg tracking-wide"
            >
              <Scissors className="w-5 h-5 text-amber-400" />
              Tabela de Cortes & Combos
            </button>
          </div>

          {/* Quick 1-Click Booking Box */}
          <div className="pt-2">
            <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black space-y-3 shadow-[6px_6px_0px_0px_rgba(251,191,36,1)]">
              <div className="flex items-center justify-between gap-2 border-b-2 border-zinc-100 pb-2.5">
                <span className="text-sm font-black text-black uppercase tracking-wider flex items-center gap-2 font-bebas text-xl">
                  <Zap className="w-5 h-5 text-amber-500 fill-amber-500" /> AGENDE AQUI EM 1 CLIQUE
                </span>
                <button
                  onClick={() => {
                    if (window.innerWidth >= 640) {
                      const el = document.getElementById('services-section');
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth' });
                      } else {
                        onViewServices();
                      }
                    } else {
                      onViewServices();
                    }
                  }}
                  className="text-[11px] font-bold text-black bg-amber-300 hover:bg-amber-400 px-2.5 py-0.5 rounded-full border border-black uppercase font-bebas tracking-wide transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  title="Ver mais opções de serviços"
                >
                  Mais Opções
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {featuredServices.map((service, idx) => {
                  const tagText = service.featuredTag || (idx === 0 ? 'MAIS PEDIDO' : idx === 1 ? 'ESPECIAL' : 'COMPLETO');
                  return (
                    <button
                      key={service.id || idx}
                      onClick={() => {
                        onOpenBookingModal(service);
                      }}
                      className="p-3.5 rounded-xl border-2 border-black bg-zinc-50 hover:bg-amber-300 text-left transition-all relative group shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:scale-[1.02] active:scale-95 cursor-pointer"
                    >
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border border-black mb-1.5 inline-block ${
                          idx === 0
                            ? 'bg-red-600 text-white'
                            : idx === 1
                            ? 'bg-blue-600 text-white'
                            : 'bg-black text-amber-400'
                        }`}
                      >
                        {tagText}
                      </span>
                      <div className="font-extrabold text-xs sm:text-sm text-black group-hover:underline leading-tight line-clamp-2">
                        {service.name}
                      </div>
                      <div className="text-sm text-zinc-900 font-black mt-1 flex items-center justify-between">
                        <span>R$ {service.price.toFixed(2)}</span>
                        <span className="text-[10px] font-normal text-zinc-600 font-sans">{service.durationMinutes} min</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: INSTAGRAM STORY FRAME SIMULATION */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="relative w-full max-w-[330px] sm:max-w-[360px]">
            
            {/* FLOATING DECORATIVE BADGE (CENTERED ON MOBILE ABOVE STORY SIMULATION) */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 sm:left-auto sm:-left-3 sm:translate-x-0 z-50 bg-amber-400 text-black font-bebas text-xs sm:text-sm px-3.5 py-1 rounded-lg uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] rotate-0 sm:rotate-[-6deg] border-2 border-black font-black flex items-center gap-1.5 pointer-events-none whitespace-nowrap">
              <Sparkles className="w-4 h-4 text-black fill-black" /> GALERIA AO VIVO
            </div>

            {/* INSTAGRAM STORY PHONE CONTAINER (PROPORÇÃO TELA DE CELULAR 9:16) */}
            <div className="relative w-full aspect-[9/16] rounded-[36px] border-4 border-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] bg-zinc-950 overflow-hidden select-none flex flex-col justify-between group">
              
              {/* Phone Camera Notch (FLUSH AT TOP RIDGE) */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-2.5 bg-black rounded-b-xl z-50 flex items-center justify-center pointer-events-none">
                <div className="w-2 h-2 rounded-full bg-zinc-900 border border-zinc-800" />
              </div>

              {/* STORY TOP HEADER OVERLAY */}
              <div className="relative z-30 p-3 pt-5 sm:pt-6 space-y-2.5 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
                
                {/* Story Segmented Progress Bars */}
                <div className="flex items-center gap-1.5 w-full">
                  {stories.map((s, idx) => {
                    const isPast = idx < currentStoryIndex;
                    const isCurrent = idx === currentStoryIndex;

                    return (
                      <div key={s.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                        <div 
                          key={`story-progress-${idx}-${currentStoryIndex}-${isStoryPaused}-${isHolding}`}
                          className={`h-full bg-white ${
                            isPast
                              ? 'w-full'
                              : isCurrent
                              ? 'story-loading-bar'
                              : 'w-0'
                          }`}
                          style={{
                            animationDuration: `${currentSlideDuration}ms`,
                            animationPlayState: isStoryPaused || isHolding ? 'paused' : 'running',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Story Author & Meta */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Story Gradient Avatar Ring */}
                    <div className="p-[2px] rounded-full bg-gradient-to-tr from-amber-400 via-amber-500 to-rose-500 shrink-0">
                      <img 
                        src={avatarUrl}
                        alt="Logo Story"
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-full bg-black object-cover border border-black"
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-white tracking-tight truncate">
                          {username}
                        </span>
                        <ShieldCheck className="w-3.5 h-3.5 text-sky-400 fill-sky-400 shrink-0" />
                      </div>
                      <span className="text-[10px] font-medium text-zinc-300 flex items-center gap-1 truncate">
                        {activeStory.time || '2 h'} • {activeStory.barber || 'Equipe'}
                      </span>
                    </div>
                  </div>

                  {/* Pause / Play Indicator Toggle Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsStoryPaused(!isStoryPaused);
                    }}
                    className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/80 border border-white/20 transition-all active:scale-95 z-40 shrink-0"
                    title={isStoryPaused ? "Play" : "Pausar"}
                  >
                    {isStoryPaused ? <Play className="w-3.5 h-3.5 fill-white" /> : <Pause className="w-3.5 h-3.5 fill-white" />}
                  </button>
                </div>

              </div>

              {/* STORY IMAGE/VIDEO CONTENT SLIDE (HIGHLY OPTIMIZED FOR MOBILE PERFORMANCE) */}
              <div className="absolute inset-0 z-10">
                {activeStory && (
                  <div
                    key={activeStory.id || activeStoryIndex}
                    className="absolute inset-0 z-10 pointer-events-auto"
                  >
                    <MediaRenderer
                      src={activeStory.image}
                      alt={activeStory.title}
                      className="w-full h-full object-cover"
                      isVideo={activeStory.isVideo}
                      isActive={true}
                      shouldPlay={!isStoryPaused && !isHolding}
                      onVideoEnded={handleVideoEnded}
                      onVideoDuration={handleVideoDuration}
                    />
                    {/* Gradient Dim Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 pointer-events-none" />
                  </div>
                )}
              </div>

              {/* FLOATING HEARTS ANIMATION CONTAINER */}
              <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
                {floatingHearts.map((heart) => (
                  <div
                    key={heart.id}
                    className="absolute bottom-14 animate-float-heart"
                    style={{
                      left: `${heart.leftPercent}%`,
                      ['--rot' as any]: `${heart.rotDeg}deg`,
                      ['--drift' as any]: `${heart.driftPx}px`,
                    }}
                  >
                    <Heart
                      className={heart.colorClass}
                      style={{ width: `${heart.sizePx}px`, height: `${heart.sizePx}px` }}
                    />
                  </div>
                ))}
              </div>

              {/* INTERACTIVE INSTAGRAM-STYLE TOUCH/TAP & PRESS-HOLD ZONES */}
              <div className="absolute inset-0 z-20 flex pt-16 pb-28">
                {/* Left Tap & Hold Zone (30% width) */}
                <div 
                  onMouseDown={handlePointerDown}
                  onMouseUp={() => handlePointerUp(true)}
                  onTouchStart={handlePointerDown}
                  onTouchEnd={() => handlePointerUp(true)}
                  onMouseLeave={() => setIsHolding(false)}
                  className="w-1/3 h-full cursor-pointer"
                  title="Toque para Voltar | Mantenha pressionado para Pausar"
                />
                {/* Right Tap & Hold Zone (70% width) */}
                <div 
                  onMouseDown={handlePointerDown}
                  onMouseUp={() => handlePointerUp(false)}
                  onTouchStart={handlePointerDown}
                  onTouchEnd={() => handlePointerUp(false)}
                  onMouseLeave={() => setIsHolding(false)}
                  className="w-2/3 h-full cursor-pointer"
                  title="Toque para Avançar | Mantenha pressionado para Pausar"
                />
              </div>

              {/* STORY BOTTOM OVERLAY & CTAs */}
              <div className="relative z-30 p-4 space-y-3.5 bg-gradient-to-t from-black via-black/80 to-transparent">
                
                {/* Story Tag & Title */}
                <div className="space-y-1.5">
                  <span className="inline-block px-2.5 py-0.5 rounded-md bg-amber-400 text-black font-bebas text-xs font-black tracking-wider uppercase border border-black">
                    {activeStory.tag || 'CORTE DO DIA'}
                  </span>
                  <p className="text-sm font-bold text-white leading-tight drop-shadow-md">
                    {activeStory.title}
                  </p>
                </div>

                {/* Direct Action Button Simulation */}
                <button
                  onClick={() => onOpenBookingModal()}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-100 text-black font-extrabold uppercase tracking-wider font-bebas text-base border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2 my-1"
                >
                  {renderCtaIcon(activeStory.ctaIcon)}
                  {activeStory.ctaText || 'Agendar Este Corte'}
                </button>

                {/* Simulated Story Message Bar (DECORATIVE ONLY & HEART BUTTON REACTION) */}
                <div className="flex items-center gap-2.5 pt-2">
                  <div className="flex-1 bg-white/15 border border-white/20 rounded-full px-3.5 py-2 text-xs text-zinc-300 flex items-center justify-between pointer-events-none select-none cursor-default">
                    <span>Enviar mensagem...</span>
                    <Send className="w-3.5 h-3.5 text-zinc-300" />
                  </div>

                  <button
                    onClick={triggerHeartReaction}
                    className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-all active:scale-125 z-40 shrink-0"
                    title="Enviar Coração"
                  >
                    <Heart className={`w-4 h-4 transition-all duration-300 ${storyLiked ? 'fill-rose-500 text-rose-500 scale-110' : 'text-white'}`} />
                  </button>
                </div>

              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

