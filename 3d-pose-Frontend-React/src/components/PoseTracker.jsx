import { useState, useEffect } from 'react';
import socket from '../utils/socket';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

// Registering chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const PoseTracker = () => {
  const [angle, setAngle] = useState(null);
  const [reps, setReps] = useState(0);
  const [stage, setStage] = useState("");
  const [tracking, setTracking] = useState(false);
  const [poseData, setPoseData] = useState({
    shoulderX: [],
    shoulderY: [],
    elbowX: [],
    elbowY: [],
    wristX: [],
    wristY: []
  });
  const [cameraStream, setCameraStream] = useState(null);

  const handleStart = () => {
    socket.emit("start_tracking");
    setTracking(true);
    setCameraStream(true);  // Start showing camera feed
  };

  const handleStop = () => {
    socket.emit("stop_tracking");
    setTracking(false);
    setCameraStream(false);
    setAngle(0);
    setReps(0);
    setStage('');
  };

  useEffect(() => {
    socket.on("pose_data", data => {
      setAngle(data.angle.toFixed(2));
      setReps(data.reps);
      setStage(data.stage);

      // Limit the number of points shown on the graph
      setPoseData(prevData => {
        // Add new data points and keep only the latest 100 points
        const maxPoints = 50;
        const updateData = (key, newValue) => {
          const updatedData = [...prevData[key], newValue];
          return updatedData.length > maxPoints ? updatedData.slice(updatedData.length - maxPoints) : updatedData;
        };

        return {
          shoulderX: updateData("shoulderX", data.shoulderX),
          shoulderY: updateData("shoulderY", data.shoulderY),
          elbowX: updateData("elbowX", data.elbowX),
          elbowY: updateData("elbowY", data.elbowY),
          wristX: updateData("wristX", data.wristX),
          wristY: updateData("wristY", data.wristY)
        };
      });
    });

    return () => {
      socket.off("pose_data");
    };
  }, []);

  // Chart.js data for real-time plotting
  const chartData = {
    labels: Array(poseData.shoulderX.length).fill(''), // Empty labels as this will be continuous
    datasets: [
      {
        label: 'Shoulder X',
        data: poseData.shoulderX,
        borderColor: 'rgb(255, 99, 132)',
        borderWidth: 1, // Adjust line width
        fill: false,
      },
      {
        label: 'Shoulder Y',
        data: poseData.shoulderY,
        borderColor: 'rgb(54, 162, 235)',
        borderWidth: 1, // Adjust line width
        fill: false,
      },
      {
        label: 'Elbow X',
        data: poseData.elbowX,
        borderColor: 'rgb(75, 192, 192)',
        borderWidth: 1, // Adjust line width
        fill: false,
      },
      {
        label: 'Elbow Y',
        data: poseData.elbowY,
        borderColor: 'rgb(153, 102, 255)',
        borderWidth: 1, // Adjust line width
        fill: false,
      },
      {
        label: 'Wrist X',
        data: poseData.wristX,
        borderColor: 'rgb(255, 159, 64)',
        borderWidth: 1, // Adjust line width
        fill: false,
      },
      {
        label: 'Wrist Y',
        data: poseData.wristY,
        borderColor: 'rgb(255, 205, 86)',
        borderWidth: 1, // Adjust line width
        fill: false,
      },
    ],
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <h1>Real-Time 3D Pose Tracker</h1>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={handleStart} style={{ marginRight: '10px' }}>Start</button>
        <button onClick={handleStop}>Stop</button>
      </div>
      <div style={{display:"flex", gap:"20px", justifyContent:"center"}}>
            <p><strong>Angle:</strong> {angle}</p>
            <p><strong>Reps:</strong> {reps}</p>
            <p><strong>Stage:</strong> {stage}</p>
          </div>

      {tracking ? (
        <>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            border: '3px solid #ccc',
            borderRadius: '10px',
            width: '100%',
            margin: 'auto',
            padding:"10px",
            marginBottom: '20px'
          }}>
            
            {/* Camera Feed on Left Side */}
            {cameraStream && (
              <div style={{ width: '100%' }}>
                <img
                  src="http://localhost:5000/video_feed"
                  alt="Pose Camera"
                  style={{ width: '100%', borderRadius: '10px' }}
                />
              </div>
            )}

            {/* Graph on Right Side */}
            <div style={{ width: '100%'}}>
              <Line data={chartData} style={{border:"2px solid" , borderRadius:"10px", width:"600px", height:"500px", marginLeft:"10px"}}/>
            </div>
          </div>

          
        </>
      ) : (
        <p style={{ marginTop: '20px', fontSize: '18px', color: '#666' }}>
          Click on the start button to track the pose.
        </p>
      )}
    </div>
  );
};

export default PoseTracker;