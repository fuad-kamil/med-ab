import { useState } from 'react';
import PreferencesControls from '../../components/PreferencesControls';

export default function TypographySpecimen() {
  const [lang, setLang] = useState('en');
  const isRtl = lang === 'ar';

  return (
    <div className="min-h-screen bg-surface-950 text-surface-100 p-6 sm:p-10 space-y-10 font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-surface-800 pb-6">
        <div>
          <h1 className="font-sans text-3xl font-bold text-teal-400">Typography System Specimen</h1>
          <p className="text-sm text-surface-400 mt-1">
            Visual specimen for Medresa Exam Portal typography scale, font roles, scripts, and tabular numbers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-surface-900 border border-surface-700 text-sm font-medium"
          >
            <option value="en">English (en)</option>
            <option value="am">Amharic (am)</option>
            <option value="ar">Arabic (ar)</option>
          </select>
          <PreferencesControls />
        </div>
      </header>

      {/* 1. Font Roles */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-teal-300 border-b border-surface-800 pb-2">1. Font Roles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card p-5 space-y-2">
            <span className="text-xs font-semibold text-teal-400 font-mono">font-sans (UI Chrome)</span>
            <p className="font-sans text-base">
              The quick brown fox jumps over the lazy dog. 1234567890.
              <br />
              መድረሳ የፈተና ፖርታል - እንኳን ደህና መጡ።
              <br />
              بوابة الامتحانات والتقييم للمدرسة.
            </p>
          </div>

          <div className="glass-card p-5 space-y-2">
            <span className="text-xs font-semibold text-teal-400 font-mono">font-content (Exam Content)</span>
            <p className="font-content text-base">
              Question 1: What is the primary source of Islamic law?
              <br />
              ጥያቄ 1: የኢስላም የመጀመሪያው እና ዋናው መመሪያ ምንድነው?
              <br />
              السؤال الأول: ما هو المصدر الأول والأهم للتشريع الإسلامي؟
            </p>
          </div>

          <div className="glass-card p-5 space-y-2">
            <span className="text-xs font-semibold text-teal-400 font-mono">font-quran (Qur'anic Verses)</span>
            <p className="font-quran text-2xl text-teal-300" dir="rtl">
              بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
              <br />
              ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ ﴿٢﴾ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ﴿٣﴾
            </p>
          </div>

          <div className="glass-card p-5 space-y-2">
            <span className="text-xs font-semibold text-teal-400 font-mono">font-mono (IDs & System Codes)</span>
            <p className="font-mono text-sm" dir="ltr">
              ID: STU-2026-9482
              <br />
              Passcode: K9#mP$2026
              <br />
              https://medresa-exam-portal.vercel.app/exam/68f201
            </p>
          </div>
        </div>
      </section>

      {/* 2. Type Scale */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-teal-300 border-b border-surface-800 pb-2">2. Type Scale</h2>
        <div className="glass-card p-6 space-y-4">
          <div>
            <span className="text-xs font-mono text-surface-400">Display (32-36px / 700)</span>
            <p className="font-sans text-[32px] sm:text-[36px] font-bold leading-tight">Display Heading Sample</p>
          </div>
          <div>
            <span className="text-xs font-mono text-surface-400">H1 (24-28px / 700)</span>
            <h1 className="font-sans text-[24px] sm:text-[28px] font-bold leading-tight">Heading Level 1</h1>
          </div>
          <div>
            <span className="text-xs font-mono text-surface-400">H2 (20-24px / 600)</span>
            <h2 className="font-sans text-[20px] sm:text-[24px] font-semibold">Heading Level 2</h2>
          </div>
          <div>
            <span className="text-xs font-mono text-surface-400">H3 (17-18px / 600)</span>
            <h3 className="font-sans text-[17px] sm:text-[18px] font-semibold">Heading Level 3</h3>
          </div>
          <div>
            <span className="text-xs font-mono text-surface-400">Body (15-16px / 400)</span>
            <p className="font-sans text-[15px] sm:text-[16px] leading-relaxed">
              Body copy text designed for high legibility across screens of all sizes.
            </p>
          </div>
          <div>
            <span className="text-xs font-mono text-surface-400">Small (13px / 500)</span>
            <p className="font-sans text-[13px] font-medium text-surface-300">Small secondary meta information text.</p>
          </div>
          <div>
            <span className="text-xs font-mono text-surface-400">Caption (12px / 400 - strict floor)</span>
            <p className="font-sans text-[12px] text-surface-400">Caption text, badges, and timestamps (never below 12px).</p>
          </div>
        </div>
      </section>

      {/* 3. Weights & Tabular Numbers */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-teal-300 border-b border-surface-800 pb-2">3. Weights & Tabular Numbers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card p-5 space-y-3">
            <h3 className="text-base font-semibold text-teal-400">Font Weights</h3>
            <p className="font-sans font-normal">Weight 400 (Regular): Medresa Portal UI</p>
            <p className="font-sans font-medium">Weight 500 (Medium): Student Record Item</p>
            <p className="font-sans font-semibold">Weight 600 (Semibold): Card Action Button</p>
            <p className="font-sans font-bold">Weight 700 (Bold): Primary Section Title</p>
          </div>

          <div className="glass-card p-5 space-y-3">
            <h3 className="text-base font-semibold text-teal-400">Tabular Nums (.tabular-nums)</h3>
            <div className="font-mono text-sm space-y-1 tabular-nums">
              <div className="flex justify-between border-b border-surface-800 py-1">
                <span>Timer Countdown:</span>
                <span className="font-bold text-teal-400">00:45:19</span>
              </div>
              <div className="flex justify-between border-b border-surface-800 py-1">
                <span>Total Score:</span>
                <span className="font-bold text-teal-400">98 / 100</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Passing Percentage:</span>
                <span className="font-bold text-emerald-400">98.0%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Mixed Script Robustness Test */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-teal-300 border-b border-surface-800 pb-2">4. Mixed Script Robustness</h2>
        <div className="glass-card p-5 space-y-3 font-content">
          <p className="text-base">
            <strong>English + Arabic:</strong> Student Ahmed Al-Mansoor (أحمد المنصور) submitted Exam #402.
          </p>
          <p className="text-base">
            <strong>Amharic + English:</strong> ተማሪ Abebe Kebede (STU-9402) ውጤት 95% አግኝቷል።
          </p>
          <p className="text-base overflow-hidden text-ellipsis whitespace-nowrap">
            <strong>Long Unbroken String:</strong> Supercalifragilisticexpialidocious_MedresaExamPortal_2026_Verification_Token_Hash_x94827103948201
          </p>
        </div>
      </section>
    </div>
  );
}
