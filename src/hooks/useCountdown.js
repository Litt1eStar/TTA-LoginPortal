import { useState, useEffect } from 'react';
import { FINAL_DEADLINE } from '../data/tracks';

export const useCountdown = (targetDate = FINAL_DEADLINE) => {
  const calculateTimeLeft = () => {
    const diff = Math.max(0, new Date(targetDate).getTime() - Date.now());
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(2, '0'),
      minutes: String(Math.floor((diff / 1000 / 60) % 60)).padStart(2, '0'),
      seconds: String(Math.floor((diff / 1000) % 60)).padStart(2, '0'),
      isExpired: diff <= 0
    };
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
};
