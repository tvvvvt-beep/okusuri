"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ name: string; usage: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Reset states
    setError(null);
    setResult(null);
    setFile(selectedFile);

    // Create preview
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreview(objectUrl);

    // Start analysis
    await analyzeImage(selectedFile);
  };

  const analyzeImage = async (imageFile: File) => {
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("画像の解析に失敗しました");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "不明なエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>お薬パシャッ！</h1>
        <p className={styles.subtitle}>カメラをかざすと、一発で何の薬かわかります</p>
      </header>

      <main className={styles.main}>
        {/* State 1: Upload / Camera */}
        {!preview && !isLoading && !result && (
          <section className={styles.uploadSection}>
            <div className={styles.uploadCard}>
              <svg
                className={styles.cameraIcon}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <p className={styles.uploadText}>ここをタップして撮影</p>
                <p className={styles.uploadSubtext}>スマホのカメラが起動します</p>
              </div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className={styles.fileInput}
                onChange={handleFileChange}
              />
            </div>
          </section>
        )}

        {/* State 2: Loading & Preview */}
        {preview && isLoading && (
          <section className={styles.loadingSection}>
            <div className={styles.spinner}></div>
            <p className={styles.loadingText}>AIが薬を判定中...</p>
            <div className={styles.previewImageContainer}>
              <Image src={preview} alt="Preview" fill className={styles.previewImage} />
            </div>
          </section>
        )}

        {/* State 3: Result */}
        {result && !isLoading && (
          <section className={styles.resultSection}>
            <div className={styles.resultCard}>
              {preview && (
                <div className={styles.previewImageContainer}>
                  <Image src={preview} alt="Analyzed Medicine" fill className={styles.previewImage} />
                </div>
              )}
              <div className={styles.resultContent}>
                <h2 className={styles.drugName}>{result.name}</h2>
                <div className={styles.drugUsage}>
                  <p>{result.usage}</p>
                </div>
              </div>
              <button onClick={reset} className={styles.resetButton}>
                別の薬を判定する
              </button>
            </div>
          </section>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <section className={styles.resultSection}>
            <div className={styles.resultCard} style={{ borderColor: 'red' }}>
              <h2 className={styles.drugName} style={{ color: 'red' }}>エラー</h2>
              <div className={styles.drugUsage}>
                <p>{error}</p>
              </div>
              <button onClick={reset} className={styles.resetButton}>
                もう一度試す
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
