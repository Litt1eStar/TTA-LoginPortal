import React, { useState } from 'react';
import { usePortal } from '../../context/PortalContext';
import { generateCsvTemplateContent } from '../../data/csvTemplate';
import { parseCsvText, evaluateCsvRows } from '../../hooks/useCsvParser';
import {
  X,
  FileCsv,
  DownloadSimple,
  UploadSimple,
  CheckCircle,
  WarningCircle,
  ArrowRight
} from '@phosphor-icons/react';

export const CsvImportModal = ({ isOpen, onClose, trackId }) => {
  const { importCsvMembers, submissions, showToast } = usePortal();
  const sub = submissions[trackId] || { members: [] };

  const [fileName, setFileName] = useState('');
  const [headerError, setHeaderError] = useState('');
  const [evaluatedRows, setEvaluatedRows] = useState([]);
  const [importMode, setImportMode] = useState('append'); // 'append' | 'replace'
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const validRows = evaluatedRows.filter(r => r.ok);
  const errorCount = evaluatedRows.length - validRows.length;

  const handleDownloadTemplate = () => {
    const csvContent = generateCsvTemplateContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ttaa13-team-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('ดาวน์โหลดแม่แบบ ttaa13-team-template.csv แล้ว');
  };

  const processFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    setHeaderError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const parsed = parseCsvText(text);
      const res = evaluateCsvRows(parsed, sub.members);

      setHeaderError(res.headerError);
      setEvaluatedRows(res.rows);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleConfirmImport = () => {
    if (validRows.length === 0) return;
    importCsvMembers(trackId, validRows, importMode);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(22, 24, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999,
      padding: '16px'
    }}>
      <div
        className="animate-slide-up"
        style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          width: 'min(100%, 720px)',
          boxShadow: '0 24px 60px -12px rgba(22, 24, 42, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #ECECF1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: '#EAF5FE',
              color: '#2A9FF7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileCsv size={24} weight="duotone" />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1B1D29' }}>
                นำเข้ารายชื่อสมาชิกทีมผ่าน CSV
              </h3>
              <p style={{ fontSize: '12.5px', color: '#6B6F80' }}>
                อัปโหลดไฟล์ CSV เพื่อเพิ่มอาจารย์และนักศึกษาจำนวนมากในครั้งเดียว
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: '#6B6F80',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Download Template Banner */}
          <div style={{
            background: '#F6F6F9',
            border: '1px solid #ECECF1',
            borderRadius: '16px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#1B1D29' }}>
                ยังไม่มีแบบฟอร์มไฟล์ CSV หรือไม่?
              </div>
              <div style={{ fontSize: '12.5px', color: '#6B6F80' }}>
                ดาวน์โหลดไฟล์ตัวอย่างที่มีคอลัมน์และคำอธิบายถูกต้องตามข้อกำหนด
              </div>
            </div>
            <button
              onClick={handleDownloadTemplate}
              style={{
                background: '#FFFFFF',
                border: '1px solid #D5D7E0',
                color: '#1B1D29',
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              <DownloadSimple size={15} weight="bold" />
              <span>ดาวน์โหลดแม่แบบ CSV</span>
            </button>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            style={{
              border: isDragging ? '2px dashed #FF5F1C' : '2px dashed #D5D7E0',
              background: isDragging ? '#FFF8F4' : '#FAFAFC',
              borderRadius: '18px',
              padding: '28px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={() => document.getElementById('csv-file-input')?.click()}
          >
            <input
              id="csv-file-input"
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#FFF1EB',
              color: '#FF5F1C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <UploadSimple size={24} weight="bold" />
            </div>
            <div>
              <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1B1D29' }}>
                {fileName ? fileName : 'คลิกเพื่อเลือกไฟล์ หรือลากไฟล์ CSV มาวางที่นี่'}
              </div>
              <div style={{ fontSize: '12px', color: '#6B6F80', marginTop: '2px' }}>
                รองรับไฟล์นามสกุล .csv (UTF-8 encoding)
              </div>
            </div>
          </div>

          {/* Header Error Alert */}
          {headerError && (
            <div style={{
              background: '#FFF1EB',
              border: '1px solid rgba(255, 95, 28, 0.3)',
              color: '#C2410C',
              padding: '12px 16px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <WarningCircle size={18} weight="fill" />
              <span>{headerError}</span>
            </div>
          )}

          {/* Evaluation Table Preview */}
          {evaluatedRows.length > 0 && (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1B1D29' }}>
                  ตรวจสอบข้อมูล ({validRows.length} รายการพร้อมนำเข้า{errorCount > 0 ? `, ${errorCount} รายการมีข้อผิดพลาด` : ''})
                </div>
              </div>

              <div style={{
                border: '1px solid #ECECF1',
                borderRadius: '14px',
                overflow: 'hidden',
                maxHeight: '220px',
                overflowY: 'auto'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#F6F6F9', color: '#6B6F80', borderBottom: '1px solid #ECECF1' }}>
                      <th style={{ padding: '10px 12px', fontWeight: 700, width: '40px' }}>#</th>
                      <th style={{ padding: '10px 12px', fontWeight: 700 }}>ประเภท</th>
                      <th style={{ padding: '10px 12px', fontWeight: 700 }}>ชื่อ - นามสกุล</th>
                      <th style={{ padding: '10px 12px', fontWeight: 700 }}>รหัส / อีเมล</th>
                      <th style={{ padding: '10px 12px', fontWeight: 700 }}>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluatedRows.map((r) => (
                      <tr
                        key={r.line}
                        style={{
                          borderBottom: '1px solid #F0F1F5',
                          background: r.ok ? '#FFFFFF' : '#FFF8F4'
                        }}
                      >
                        <td style={{ padding: '10px 12px', color: '#9A9DAD', fontWeight: 600 }}>{r.line}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '8px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            background: r.type === 'advisor' ? '#FFF8DB' : '#EAF5FE',
                            color: r.type === 'advisor' ? '#8A5A00' : '#0A65B0'
                          }}>
                            {r.type === 'advisor' ? 'อาจารย์' : 'นักศึกษา'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1B1D29' }}>
                          {r.fullName}
                          {r.isLeader && (
                            <span style={{
                              marginLeft: '6px',
                              fontSize: '11px',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              background: '#FFF1EB',
                              color: '#FF5F1C',
                              fontWeight: 700
                            }}>
                              หัวหน้าทีม
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#6B6F80' }}>
                          <div>{r.studentId}</div>
                          <div style={{ fontSize: '11.5px' }}>{r.email}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {r.ok ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: '#0A65B0',
                              fontWeight: 700,
                              fontSize: '12px'
                            }}>
                              <CheckCircle size={14} weight="fill" />
                              <span>พร้อม</span>
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: '#C2410C',
                              fontWeight: 700,
                              fontSize: '12px'
                            }}>
                              <WarningCircle size={14} weight="fill" />
                              <span>{r.error}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mode Selection */}
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1B1D29', marginBottom: '8px' }}>
                  รูปแบบการนำเข้าข้อมูล
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '12px',
                    borderRadius: '12px',
                    border: importMode === 'append' ? '2px solid #FF5F1C' : '1.5px solid #E0E1E8',
                    background: importMode === 'append' ? '#FFF8F4' : '#FFFFFF',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      style={{ marginTop: '3px', accentColor: '#FF5F1C' }}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#1B1D29' }}>
                        เพิ่มต่อท้าย (Append)
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#6B6F80' }}>
                        คงรายชื่อเดิมไว้ และเพิ่มเฉพาะรายชื่อใหม่เข้าไป
                      </div>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '12px',
                    borderRadius: '12px',
                    border: importMode === 'replace' ? '2px solid #FF5F1C' : '1.5px solid #E0E1E8',
                    background: importMode === 'replace' ? '#FFF8F4' : '#FFFFFF',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      style={{ marginTop: '3px', accentColor: '#FF5F1C' }}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#1B1D29' }}>
                        แทนที่ทั้งหมด (Replace)
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#6B6F80' }}>
                        ลบรายชื่อเดิมในหมวดนี้ และใส่เฉพาะรายชื่อจากไฟล์
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #ECECF1',
          background: '#FAFAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              background: '#FFFFFF',
              border: '1px solid #E0E1E8',
              color: '#6B6F80',
              fontWeight: 600,
              fontSize: '13.5px'
            }}
          >
            ยกเลิก
          </button>

          <button
            type="button"
            disabled={validRows.length === 0}
            onClick={handleConfirmImport}
            style={{
              padding: '10px 22px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #FF5F1C 0%, #FF8D20 100%)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '13.5px',
              boxShadow: '0 4px 12px rgba(255, 95, 28, 0.35)',
              opacity: validRows.length === 0 ? 0.45 : 1,
              cursor: validRows.length === 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>นำเข้า {validRows.length} รายชื่อ</span>
            <ArrowRight size={14} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
};
