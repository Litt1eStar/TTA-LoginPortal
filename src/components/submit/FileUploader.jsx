import React, { useState } from 'react';
import { usePortal } from '../../context/PortalContext';
import { SectionNum } from './SectionNum';
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

const fileIcon = (ext) => {
  switch (ext) {
    case 'pdf': return <FilePdf size={24} weight="fill" color="var(--primary)" />;
    case 'zip': return <FileZip size={24} weight="fill" color="#B07A00" />;
    case 'ppt':
    case 'pptx': return <FilePpt size={24} weight="fill" color="var(--danger)" />;
    default: return <File size={24} weight="fill" color="var(--text-muted)" />;
  }
};

export const FileUploader = ({ trackId, isLocked, error, number, done }) => {
  const { submissions, addFiles, removeFile } = usePortal();
  const sub = submissions[trackId] || { files: [] };
  const [isDragging, setIsDragging] = useState(false);
  const inputId = `file-upload-${trackId}`;

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (isLocked) return;
    if (e.dataTransfer.files?.length) addFiles(trackId, e.dataTransfer.files);
  };

  const handleInputChange = (e) => {
    if (e.target.files?.length) addFiles(trackId, e.target.files);
    e.target.value = '';
  };

  return (
    <div className="card" id="section-deliverables">
      <div>
        <h3 className="section-title">
          <SectionNum number={number} done={done} />
          ไฟล์ผลงาน
        </h3>
        <p className="section-desc">ไฟล์ PDF, ZIP, PPT หรือ PPTX ไม่เกิน 50 MB ต่อไฟล์</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <WarningCircle size={18} weight="fill" />
          <span>{error}</span>
        </div>
      )}

      {!isLocked && (
        <div
          className="dropzone clickable"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById(inputId)?.click()}
          style={{
            borderColor: isDragging ? 'var(--primary)' : undefined,
            background: isDragging ? '#FFF8F4' : undefined,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <input
            id={inputId}
            type="file"
            multiple
            accept=".pdf,.zip,.ppt,.pptx"
            style={{ display: 'none' }}
            onChange={handleInputChange}
          />
          <UploadSimple size={30} weight="bold" color="var(--primary)" />
          <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>
            คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
          </div>
        </div>
      )}

      {sub.files?.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sub.files.map((file) => {
            const isError = file.status === 'error';
            return (
              <div
                key={file.id}
                className="row-item"
                style={isError ? { background: '#FFF8F4', borderColor: '#FFD0BD', flexWrap: 'nowrap' } : { flexWrap: 'nowrap' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  {fileIcon(file.ext)}
                  <div style={{ minWidth: 0 }}>
                    <div className="row-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </div>
                    <div className="row-meta" style={isError ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>
                      {isError ? file.error : formatSize(file.size)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {!isError && (
                    <span className="badge badge-blue">
                      <CheckCircle size={14} weight="fill" />
                      พร้อมส่ง
                    </span>
                  )}
                  {!isLocked && (
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => removeFile(trackId, file.id)}
                      title="ลบไฟล์"
                      aria-label={`ลบไฟล์ ${file.name}`}
                    >
                      <Trash size={18} weight="bold" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        isLocked && <div className="dropzone">ไม่มีไฟล์ที่อัปโหลด</div>
      )}
    </div>
  );
};
