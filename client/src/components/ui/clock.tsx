import { useState } from "react";

interface ClockProps {
  className?: string;
}

export default function Clock({ className = "" }: ClockProps) {
    let time  = new Date().toLocaleTimeString()

    const [ctime,setTime] = useState(time)
    const UpdateTime=()=>{
      time =  new Date().toLocaleTimeString()
      setTime(time)
    }
    setInterval(UpdateTime)
  return (
    <div className={`text-lg font-semibold text-primary ${className}`}>
      {ctime}
    </div>
  );
}