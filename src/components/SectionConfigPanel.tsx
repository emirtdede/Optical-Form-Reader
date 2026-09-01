import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, RotateCcw, Sliders, Trash2 } from 'lucide-react';
import type { ExamSection } from '../types';
import { getDefaultSections } from '../domain/grading';

interface SectionConfigPanelProps {
  sections: ExamSection[];
  onChangeSections: (sections: ExamSection[]) => void;
  questionWeights: number[];
  onChangeQuestionWeights: (weights: number[]) => void;
  disabled?: boolean;
}

export function SectionConfigPanel({
  sections,
  onChangeSections,
  questionWeights,
  onChangeQuestionWeights,
  disabled = false,
}: SectionConfigPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<'sectionWeights' | 'questionWeights'>('sectionWeights');

  function handleAddSection() {
    const lastSection = sections[sections.length - 1];
    const nextStart = lastSection ? Math.min(100, lastSection.endQuestion + 1) : 1;
    const nextEnd = Math.min(100, nextStart + 24);

    const newSection: ExamSection = {
      id: `sec-${Date.now()}`,
      name: `Bölüm ${sections.length + 1}`,
      startQuestion: nextStart,
      endQuestion: nextEnd,
      weight: 1,
    };
    onChangeSections([...sections, newSection]);
  }

  function handleRemoveSection(indexToRemove: number) {
    if (sections.length <= 1) return;
    onChangeSections(sections.filter((_, idx) => idx !== indexToRemove));
  }

  function handleUpdateSection(index: number, patch: Partial<ExamSection>) {
    onChangeSections(
      sections.map((sec, idx) => (idx === index ? { ...sec, ...patch } : sec)),
    );
  }

  function handleResetDefault() {
    onChangeSections(getDefaultSections());
    onChangeQuestionWeights(Array(100).fill(1));
  }

  function handleSectionWeightChange(index: number, weight: number) {
    const validWeight = Math.max(0.1, Number(weight) || 1);
    handleUpdateSection(index, { weight: validWeight });

    // Bölümdeki soruların katsayılarını da güncelle
    const sec = sections[index];
    if (sec) {
      const nextWeights = [...questionWeights];
      for (let q = sec.startQuestion - 1; q < sec.endQuestion && q < 100; q++) {
        nextWeights[q] = validWeight;
      }
      onChangeQuestionWeights(nextWeights);
    }
  }

  function handleSingleQuestionWeight(qIndex: number, weight: number) {
    const validWeight = Math.max(0.1, Number(weight) || 1);
    const nextWeights = [...questionWeights];
    nextWeights[qIndex] = validWeight;
    onChangeQuestionWeights(nextWeights);
  }

  return (
    <article className="setup-card section-config-card">
      <div className="setup-card-top">
        <div className="section-config-header">
          <span className="setup-number">03</span>
          <div>
            <h2>Bölüm &amp; Notlandırma Yapısı</h2>
            <p>100 soruluk formun ders/bölüm aralıkları (Varsayılan 4 Parça)</p>
          </div>
        </div>
        <div className="section-config-quick-actions">
          <button
            type="button"
            className="button button-ghost button-small"
            disabled={disabled}
            onClick={handleResetDefault}
            title="4 parçalı varsayılan düzene sıfırla"
          >
            <RotateCcw size={14} /> Varsayılana Sıfırla
          </button>
        </div>
      </div>

      {/* Bölüm Listesi */}
      <div className="sections-grid-list">
        {sections.map((section, idx) => (
          <div key={section.id || idx} className="section-item-row">
            <div className="section-name-input-group">
              <label htmlFor={`sec-name-${idx}`}>Bölüm {idx + 1} Adı</label>
              <input
                id={`sec-name-${idx}`}
                type="text"
                value={section.name}
                disabled={disabled}
                placeholder={`Bölüm ${idx + 1}`}
                maxLength={35}
                onChange={(e) => handleUpdateSection(idx, { name: e.target.value })}
              />
            </div>

            <div className="section-range-group">
              <div>
                <label htmlFor={`sec-start-${idx}`}>Başlangıç</label>
                <input
                  id={`sec-start-${idx}`}
                  type="number"
                  min={1}
                  max={100}
                  value={section.startQuestion}
                  disabled={disabled}
                  onChange={(e) => handleUpdateSection(idx, { startQuestion: Number(e.target.value) })}
                />
              </div>
              <span className="range-sep">—</span>
              <div>
                <label htmlFor={`sec-end-${idx}`}>Bitiş</label>
                <input
                  id={`sec-end-${idx}`}
                  type="number"
                  min={1}
                  max={100}
                  value={section.endQuestion}
                  disabled={disabled}
                  onChange={(e) => handleUpdateSection(idx, { endQuestion: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="section-item-actions">
              <button
                type="button"
                className="section-delete-btn"
                disabled={disabled || sections.length <= 1}
                onClick={() => handleRemoveSection(idx)}
                aria-label="Bölümü sil"
                title="Bölümü sil"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="section-add-footer">
        <button
          type="button"
          className="button button-ghost button-small"
          disabled={disabled}
          onClick={handleAddSection}
        >
          <Plus size={15} /> Yeni Bölüm Ekle
        </button>

        {/* Gelişmiş Puanlama Seçenekleri Aç/Kapa Butonu */}
        <button
          type="button"
          className={`button ${showAdvanced ? 'button-secondary' : 'button-ghost'} button-small`}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Sliders size={15} />
          <span>Gelişmiş Katsayı Seçenekleri</span>
          {showAdvanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {/* Gelişmiş Katsayı Paneli (Varsayılan Gizli) */}
      {showAdvanced && (
        <div className="advanced-weights-panel" aria-label="Gelişmiş Soru Katsayıları">
          <div className="advanced-tabs-row">
            <button
              type="button"
              className={`tab-chip ${activeTab === 'sectionWeights' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('sectionWeights')}
            >
              Bölüm Katsayıları
            </button>
            <button
              type="button"
              className={`tab-chip ${activeTab === 'questionWeights' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('questionWeights')}
            >
              100 Soru Katsayı Matrisi
            </button>
          </div>

          {activeTab === 'sectionWeights' ? (
            <div className="section-weights-list">
              {sections.map((section, idx) => (
                <div key={section.id || idx} className="section-weight-row">
                  <span><strong>{section.name || `Bölüm ${idx + 1}`}</strong> ({section.startQuestion}–{section.endQuestion}. Sorular):</span>
                  <div className="weight-input-box">
                    <input
                      type="number"
                      step="0.25"
                      min="0.1"
                      max="20"
                      disabled={disabled}
                      value={section.weight ?? 1}
                      onChange={(e) => handleSectionWeightChange(idx, Number(e.target.value))}
                    />
                    <small>katsayı çarpanı</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="question-weights-matrix">
              <p className="weights-info-text">Her sorunun standart puan ağırlığını tek tek özelleştirebilirsiniz (Varsayılan: 1.0):</p>
              <div className="weights-grid-10">
                {Array.from({ length: 100 }, (_, qIdx) => (
                  <div key={qIdx} className="weight-cell">
                    <label>S{qIdx + 1}</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.1"
                      max="10"
                      disabled={disabled}
                      value={questionWeights[qIdx] ?? 1}
                      onChange={(e) => handleSingleQuestionWeight(qIdx, Number(e.target.value))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
