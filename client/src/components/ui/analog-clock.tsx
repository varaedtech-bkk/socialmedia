import { useEffect, useState } from "react";

export default function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const hourAngle = (360 / 12) * hours + (360 / 12 / 60) * minutes; // 30° per hour + 0.5° per minute
  const minuteAngle = (360 / 60) * minutes; // 6° per minute
  const secondAngle = (360 / 60) * seconds; // 6° per second

  const clockSize = 210; // 30% smaller than 300px
  const radius = 84; // 30% smaller than 120px

  const clockNumbers = Array.from({ length: 12 }, (_, i) => {
    const angle = ((i + 1) * 30 * Math.PI) / 180; // Convert degrees to radians
    return {
      number: i + 1,
      x: Math.sin(angle) * radius + clockSize / 2, // Adjust for new size
      y: -Math.cos(angle) * radius + clockSize / 2, // Adjust for new size
    };
  });

  return (
    <div
      className="relative rounded-full bg-white shadow-lg mx-auto"
      style={{ width: `${clockSize}px`, height: `${clockSize}px` }}
    >
      {/* Center dot */}
      <div className="absolute w-3 h-3 bg-gray-800 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>

      {/* Clock numbers */}
      {clockNumbers.map(({ number, x, y }) => (
        <div
          key={number}
          className="absolute text-lg font-bold"
          style={{
            left: `${x}px`,
            top: `${y}px`,
            transform: `translate(-50%, -50%)`, // Center the number on the calculated position
          }}
        >
          {number}
        </div>
      ))}

      {/* Hour hand */}
      <div
        className="absolute w-[4.2px] h-[42px] bg-gray-900 origin-bottom" // 30% smaller
        style={{
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -100%) rotate(${hourAngle}deg)`,
        }}
      ></div>

      {/* Minute hand */}
      <div
        className="absolute w-[2.8px] h-[56px] bg-gray-700 origin-bottom" // 30% smaller
        style={{
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -100%) rotate(${minuteAngle}deg)`,
        }}
      ></div>

      {/* Second hand */}
      <div
        className="absolute w-[1.4px] h-[70px] bg-red-500 origin-bottom" // 30% smaller
        style={{
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -100%) rotate(${secondAngle}deg)`,
        }}
      ></div>
    </div>
  );
}