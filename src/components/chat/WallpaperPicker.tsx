'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/apiClient';
import { CHAT_WALLPAPERS, getWallpaperStyles } from '@/lib/chatWallpapers';

// ---------- Types ----------

interface WallpaperPickerProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  currentWallpaper: string;
  onWallpaperChange: (wallpaper: string) => void;
}

// ---------- Component ----------

export default function WallpaperPicker({
  isOpen,
  onClose,
  conversationId,
  currentWallpaper,
  onWallpaperChange,
}: WallpaperPickerProps) {
  const [selectedWallpaper, setSelectedWallpaper] = useState(currentWallpaper);
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset selectedWallpaper when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedWallpaper(currentWallpaper);
      setShowToast(false);
    }
  }, [isOpen, currentWallpaper]);

  const handleApply = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/conversations/${conversationId}/wallpaper`, {
        method: 'PUT',
        body: JSON.stringify({ wallpaper: selectedWallpaper }),
      });
      onWallpaperChange(selectedWallpaper);
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        onClose();
      }, 800);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiFetch<{ url: string; filename: string }>('/api/upload/wallpaper', {
        method: 'POST',
        body: formData,
      });

      setSelectedWallpaper(`custom:${response.url}`);
    } catch {
      // silently fail
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="wallpaper-picker-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <motion.div
            key="wallpaper-picker-modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '85vh',
              overflowY: 'auto',
              borderRadius: 16,
              padding: 24,
              position: 'relative',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}>
                  Chat Wallpaper
                </span>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  color: 'var(--text-secondary)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Wallpaper Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 8,
              marginBottom: 24,
            }}>
              {CHAT_WALLPAPERS.map((wallpaper) => {
                const isSelected = selectedWallpaper === wallpaper.name;
                return (
                  <button
                    key={wallpaper.name}
                    onClick={() => setSelectedWallpaper(wallpaper.name)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <div style={{
                      width: '100%',
                      height: 56,
                      borderRadius: 8,
                      border: isSelected
                        ? '2px solid var(--accent-primary)'
                        : '2px solid var(--card-border)',
                      overflow: 'hidden',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...wallpaper.previewStyle,
                    }}>
                      {wallpaper.name === 'none' && (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                        </svg>
                      )}
                      {isSelected && (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0,0,0,0.3)',
                        }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 10,
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: isSelected ? 600 : 400,
                      textAlign: 'center',
                      lineHeight: 1.2,
                    }}>
                      {wallpaper.label}
                    </span>
                  </button>
                );
              })}

              {/* Custom wallpaper preview (if currently applied) */}
              {currentWallpaper.startsWith('custom:') && (
                <button
                  onClick={() => setSelectedWallpaper(currentWallpaper)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <div style={{
                    width: '100%',
                    height: 56,
                    borderRadius: 8,
                    border: selectedWallpaper === currentWallpaper
                      ? '2px solid var(--accent-primary)'
                      : '2px solid var(--card-border)',
                    overflow: 'hidden',
                    position: 'relative',
                    ...getWallpaperStyles(currentWallpaper),
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}>
                    {selectedWallpaper === currentWallpaper && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0,0,0,0.3)',
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10,
                    color: selectedWallpaper === currentWallpaper ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: selectedWallpaper === currentWallpaper ? 600 : 400,
                    textAlign: 'center',
                    lineHeight: 1.2,
                  }}>
                    Custom
                  </span>
                </button>
              )}

              {/* Upload option */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: 'none',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  padding: 0,
                  opacity: uploading ? 0.5 : 1,
                }}
              >
                <div style={{
                  width: '100%',
                  height: 56,
                  borderRadius: 8,
                  border: '2px dashed var(--card-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--card-bg)',
                }}>
                  {uploading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                      </svg>
                    </motion.div>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  )}
                </div>
                <span style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontWeight: 400,
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}>
                  Upload
                </span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>

            {/* Apply Button */}
            <button
              onClick={handleApply}
              disabled={saving || uploading}
              style={{
                width: '100%',
                padding: '12px 0',
                borderRadius: 12,
                border: 'none',
                background: 'var(--accent-primary)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: saving || uploading ? 'not-allowed' : 'pointer',
                opacity: saving || uploading ? 0.6 : 1,
                transition: 'all 0.3s ease',
              }}
            >
              {saving ? 'Applying...' : 'Apply Wallpaper'}
            </button>

            {/* Toast */}
            <AnimatePresence>
              {showToast && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    position: 'absolute',
                    bottom: 80,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--text-primary)',
                    color: 'var(--card-bg)',
                    padding: '6px 16px',
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                    pointerEvents: 'none',
                  }}
                >
                  Applied!
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
