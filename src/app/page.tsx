"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import styles from "./page.module.css";

type CaptureState = "INIT" | "CAPTURE_FRONT" | "CAPTURE_BACK" | "ANALYZING" | "RESULT" | "ERROR";

export default function Home() {
  const [state, setState] = useState<CaptureState>("INIT");
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; usage: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // カメラを起動する
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access failed:", err);
      setErrorMsg("カメラへのアクセスが拒否されたか、利用できません。");
      setState("ERROR");
    }
  }, []);

  // カメラを停止する
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // 画面表示や状態に応じてカメラの起動を管理
  useEffect(() => {
    if (state === "CAPTURE_FRONT" || state === "CAPTURE_BACK") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [state, startCamera, stopCamera]);

  // 現在の映像をキャプチャしてBase64を返す
  const captureImage = (): string | null => {
    if (!videoRef.current) return null;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    // 圧縮と品質調整
    return canvas.toDataURL("image/jpeg", 0.8);
  };

  const handleCapture = async () => {
    const dataUrl = captureImage();
    if (!dataUrl) return;

    if (state === "CAPTURE_FRONT") {
      setFrontImage(dataUrl);
      setState("CAPTURE_BACK");
    } else if (state === "CAPTURE_BACK") {
      setBackImage(dataUrl);
      setState("ANALYZING");
      // 両面撮れたので解析実行
      await analyzeImages(frontImage!, dataUrl);
    }
  };

  // Base64からFileオブジェクトへ変換するユーティリティ
  const dataURLtoFile = (dataUrl: string, filename: string): File => {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const analyzeImages = async (frontDataUrl: string, backDataUrl: string) => {
    try {
      const frontFile = dataURLtoFile(frontDataUrl, "front.jpg");
      const backFile = dataURLtoFile(backDataUrl, "back.jpg");

      const formData = new FormData();
      formData.append("imageFront", frontFile);
      formData.append("imageBack", backFile);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("画像の解析に失敗しました");
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setResult(data);
      setState("RESULT");
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "不明なエラーが発生しました");
      setState("ERROR");
    }
  };

  const resetAll = () => {
    setFrontImage(null);
    setBackImage(null);
    setResult(null);
    setErrorMsg(null);
    setState("INIT");
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>お薬パシャッ！</h1>
        <p className={styles.subtitle}>薬の「表」と「裏」を撮影して高精度に判定します</p>
      </header>

      <main className={styles.main}>
        {/* State: INIT */}
        {state === "INIT" && (
          <button className={styles.startButton} onClick={() => setState("CAPTURE_FRONT")}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            撮影をはじめる
          </button>
        )}

        {/* State: CAPTURE FRONT / BACK */}
        {(state === "CAPTURE_FRONT" || state === "CAPTURE_BACK") && (
          <section className={styles.cameraSection}>
            <div className={styles.capturesPreview}>
              <div className={`${styles.captureThumb} ${state === "CAPTURE_FRONT" ? styles.active : ""}`}>
                {frontImage ? <Image src={frontImage} alt="表面" fill /> : null}
                <div className={styles.captureLabel}>表面</div>
              </div>
              <div className={`${styles.captureThumb} ${state === "CAPTURE_BACK" ? styles.active : ""}`}>
                {backImage ? <Image src={backImage} alt="裏面" fill /> : null}
                <div className={styles.captureLabel}>裏面</div>
              </div>
            </div>

            <div className={styles.videoContainer}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={styles.videoElement}
              />
              <div className={styles.cameraGuideOverlay}></div>
            </div>

            <div className={styles.cameraControls}>
              <div className={styles.captureInfo}>
                {state === "CAPTURE_FRONT" ? "① お薬の表面を撮影してください" : "② お薬の裏面を撮影してください"}
              </div>
              <button
                className={styles.captureButton}
                onClick={handleCapture}
                aria-label="撮影する"
              />
              {state === "CAPTURE_BACK" && (
                <button
                  className={styles.switchCameraButton}
                  onClick={() => { setFrontImage(null); setState("CAPTURE_FRONT"); }}
                >
                  表面からやり直す
                </button>
              )}
            </div>
          </section>
        )}

        {/* State: ANALYZING */}
        {state === "ANALYZING" && (
          <section className={styles.loadingSection}>
            <div className={styles.spinner}></div>
            <p className={styles.loadingText}>AIが２枚の画像を統合して高精度判定中...</p>
          </section>
        )}

        {/* State: RESULT */}
        {state === "RESULT" && result && (
          <section className={styles.resultSection}>
            <div className={styles.resultCard}>
              <div className={styles.capturesPreview}>
                <div className={styles.captureThumb}>
                  {frontImage && <Image src={frontImage} alt="表面" fill />}
                  <div className={styles.captureLabel}>表面</div>
                </div>
                <div className={styles.captureThumb}>
                  {backImage && <Image src={backImage} alt="裏面" fill />}
                  <div className={styles.captureLabel}>裏面</div>
                </div>
              </div>
              <div className={styles.resultContent}>
                <h2 className={styles.drugName}>{result.name}</h2>
                <div className={styles.drugUsage}>
                  <p>{result.usage}</p>
                </div>
              </div>
              <button onClick={resetAll} className={styles.resetButton}>
                別の薬を判定する
              </button>
            </div>
          </section>
        )}

        {/* State: ERROR */}
        {state === "ERROR" && (
          <section className={styles.resultSection}>
            <div className={styles.resultCard} style={{ borderColor: 'red' }}>
              <h2 className={styles.drugName} style={{ color: 'red' }}>エラーが発生しました</h2>
              <div className={styles.drugUsage}>
                <p>{errorMsg}</p>
              </div>
              <button onClick={resetAll} className={styles.resetButton}>
                最初からやり直す
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
