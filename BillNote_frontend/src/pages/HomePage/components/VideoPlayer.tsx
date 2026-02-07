import React, { FC, useRef, useEffect } from 'react';

interface VideoPlayerProps {
  videoUrl: string;
  initialTime?: number;
}

export const VideoPlayer: FC<VideoPlayerProps> = ({ videoUrl, initialTime = 0 }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.src = videoUrl;
      videoRef.current.currentTime = initialTime;
      videoRef.current.play().catch(error => console.error("Error playing video:", error));
    }
  }, [videoUrl, initialTime]);

  return (
    <div className="w-full h-full bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        controls
        className="w-full h-full object-contain"
        onEnded={() => {
          if (videoRef.current) videoRef.current.currentTime = 0; // Reset to start on end
        }}
      >
        您的浏览器不支持视频播放。
      </video>
    </div>
  );
};
