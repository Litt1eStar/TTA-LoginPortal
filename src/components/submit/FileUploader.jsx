import React, { useState } from 'react';
import { usePortal } from '../../context/PortalContext';
import { formatSize } from '../../utils/formatters';
import {
  UploadSimple,
  FilePdf,
  FileZip,
  FilePpt,
  File,
  Trash,
  CheckCircle,
  WarningCircle
} from '@phosphor-icons/react';

export const FileUploader = ({ trackId, isLocked }) => {
  const { submissions, addFiles, removeFile } = usePortal();
  const sub = submissions[trackId] || { files: [] };
  const [isDragging, setIsDragging] = useState(false);

  const getFileIcon = (ext) => {
    switch (ext) {
      case 'pdf': return <FilePdf size={22} weight="fill" color="#FF5F1C" />;
      case 'zip': return <FileZip size={22} weight="fill" color="#D99A00" />;
      case 'ppt':
      case 'pptx': return <FilePpt size={22} weight="fill" color="#C2410C" />;
      default: return <File size={22} weight="fill" color="#6B6F80" />;
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (isLocked) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(trackId, e.dataTransfer.files);
    }
  };

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(trackId, e.target.files);
    }
    e.target.value = '';
  };

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '24px',
      border: '1px solid #ECECF1',
      padding: '24px',
      boxShadow: '0 2px 10px rgba(27, 29, 41, 0.03)',
      display: 'flex',
      flexDirection: 'column',
      gap: '18px'
    }}>
      <div>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1B1D29' }}>
          เอกสารและไฟล์ผลงาน (Uploaded Deliverables)
        </h3>
        <p style={{ fontSize: '13px', color: '#6B6F80', marginTop: '2px' }}>
          รองรับไฟล์ประเภท PDF, ZIP, PPT และ PPTX (ขนาดสูงสุด 50MB ต่อไฟล์)
        </p>
      </div>

      {/* Dropzone */}
      {!isLocked && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById(`file-upload-${trackId}`)?.click()}
          style={{
            border: isDragging ? '2px dashed #FF5F1C' : '2px dashed #D5D7E0',
            background: isDragging ? '#FFF8F4' : '#FAFAFC',
            borderRadius: '16px',
            padding: '26px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <input
            id={`file-upload-${trackId}`}
            type="file"
            multiple
            accept=".pdf,.zip,.ppt,.pptx"
            style={{ display: 'none' }}
            onChange={handleInputChange}
          />
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: '#FFF1EB',
            color: '#FF5F1C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <UploadSimple size={22} weight="bold" />
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#1B1D29' }}>
            ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์
          </div>
          <div style={{ fontSize: '12px', color: '#6B6F80' }}>
            PDF (แผนการสอน/รายงาน), ZIP (ซอร์สโค้ด/เอกสารรวม), PPTX (สไลด์นำเสนอ)
          </div>
        </div>
      )}

      {/* Files List */}
      {sub.files && sub.files.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sub.files.map((file) => {
            const isError = file.status === 'error';
            return (
              <div
                key={file.id}
                style={{
                  background: isError ? '#FFF8F4' : '#FAFAFC',
                  border: isError ? '1px solid #FFD0BD' : '1px solid #ECECF1',
                  borderRadius: '14px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  {getFileIcon(file.ext)}
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: '13.5px',
                      fontWeight: 700,
                      color: '#1B1D29',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: '11.5px', color: isError ? '#C2410C' : '#6B6F80', marginTop: '2px' }}>
                      {isError ? file.error : formatSize(file.size)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  {!isError && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#0A65B0',
                      background: '#EAF5FE',
                      padding: '3px 8px',
                      borderRadius: '8px'
                    }}>
                      <CheckCircle size={13} weight="fill" />
                      <span>พร้อมส่ง</span>
                    </span>
                  )}

                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => removeFile(trackId, file.id)}
                      style={{
                        background: 'transparent',
                        color: '#6B6F80',
                        padding: '6px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="ลบไฟล์นี้"
                    >
                      <Trash size={16} weight="bold" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '14px',
          color: '#9A9DAD',
          fontSize: '13px',
          background: '#FAFAFC',
          borderRadius: '12px'
        }}>
          ยังไม่มีไฟล์ที่อัปโหลดในหมวดหมู่นี้
        </div>
      )}
    </div>
  );
};
