import os
from flask import Flask, Response
from flask_socketio import SocketIO, emit
import cv2, mediapipe as mp, numpy as np
from threading import Thread, Lock

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')
mp_drawing = mp.solutions.drawing_utils
mp_pose = mp.solutions.pose

# Shared state for the camera feed and pose data
cap = None
frame_lock = Lock()
current_frame = None
tracking = False

def calculate_angle(a, b, c):
    a, b, c = np.array(a), np.array(b), np.array(c)
    radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
    angle = np.abs(radians * 180.0 / np.pi)
    return angle if angle <= 180 else 360 - angle

def pose_tracking():
    global cap, current_frame, tracking
    with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
        counter = 0
        stage = None
        while tracking:
            ret, frame = cap.read()
            if not ret:
                continue

            image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(image_rgb)
            # Copy the original frame to draw on
            image_bgr = frame.copy()

            if results.pose_landmarks:
                mp_drawing.draw_landmarks(image_bgr, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)
                landmarks = results.pose_landmarks.landmark
                shoulder = [landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].x,
                            landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].y]
                elbow = [landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value].x,
                         landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value].y]
                wrist = [landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value].x,
                         landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value].y]
                angle = calculate_angle(shoulder, elbow, wrist)
                if angle > 160:
                    stage = "down"
                if angle < 30 and stage == "down":
                    stage = "up"
                    counter += 1

                # Emit pose data (including coordinates for the graph)
                socketio.emit('pose_data', {
                    'angle': angle,
                    'reps': counter,
                    'stage': stage,
                    'shoulderX': shoulder[0],
                    'shoulderY': shoulder[1],
                    'elbowX': elbow[0],
                    'elbowY': elbow[1],
                    'wristX': wrist[0],
                    'wristY': wrist[1],
                })

            with frame_lock:
                current_frame = image_bgr.copy()

    cap.release()

@socketio.on('start_tracking')
def handle_start_tracking():
    global cap, tracking
    # Open the camera only once
    cap = cv2.VideoCapture(0)
    tracking = True
    Thread(target=pose_tracking).start()
    emit('status', {'message': 'Pose tracking started'})

@socketio.on('stop_tracking')
def handle_stop_tracking():
    global tracking
    tracking = False
    emit('status', {'message': 'Tracking stopped'})

@app.route('/video_feed')
def video_feed():
    def generate():
        global current_frame
        while True:
            with frame_lock:
                if current_frame is None:
                    continue
                ret, buffer = cv2.imencode('.jpg', current_frame)
                if not ret:
                    continue
                frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host='0.0.0.0', port=port)
