import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.resolve(__dirname, '../locales');

const enPath = path.join(localesDir, 'en.json');
const amPath = path.join(localesDir, 'am.json');
const arPath = path.join(localesDir, 'ar.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
const am = JSON.parse(fs.readFileSync(amPath, 'utf-8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf-8'));

// Ensure keys added in DeleteExamModal exist in en, am, ar
const newKeys = {
  exams: {
    deletePreserveNotice: 'Delete exam "{{title}}"? The exam, its questions, and its link will be permanently removed. Student results and scores will be kept.',
    resultsWillBeKept: '{{count}} student result(s) preserved',
    resultsKeptSub: 'All student attempts, scores, and grades stay intact on the Results page.',
    forceSubmitOptionLabel: 'Force-submit all in-progress attempts and delete',
    typeTitleToConfirm: 'Type exam title to confirm',
    deleteSuccessPreserved: 'Exam deleted. Student results have been preserved.',
    inProgressDeleteBlocked: 'Students are currently taking this exam. Select force-submit option to proceed.',
  },
  results: {
    emailResult: 'Email result',
    emailedStatus: 'Emailed',
    updatedAfterSending: 'Updated after sending',
    sendingEmail: 'Sending...',
    sendUpdatedResult: 'Send updated result',
    examDeletedBadge: 'Exam deleted',
    deleteResultsBtn: 'Delete Results',
    deleteResultsConfirmTitle: 'Delete All Exam Results',
    deleteResultsNotice: 'Are you sure you want to delete all results for this exam? This action cannot be undone.',
    typeDeleteResultsToConfirm: 'Type "DELETE RESULTS" to confirm:',
    downloadBackupFirst: 'Download Excel Backup',
    cannotRetakeDeletedTooltip: 'This exam was deleted. Retake is disabled.',
    downloadReportDocx: 'Download Result Report (.docx)',
    noEmailTooltip: 'Student has no registered email address',
    addEmailShortcut: 'Add Email',
  }
};

// Amharic versions of new keys
const newAmKeys = {
  exams: {
    deletePreserveNotice: 'የፈተናውን «{{title}}» ይሰርዙት? ፈተናው፣ ጥያቄዎቹ እና ሊንኩ በቋሚነት ይሰረዛሉ። የተማሪዎች ውጤቶች እና ነጥቦች ተጠብቀው ይቆያሉ።',
    resultsWillBeKept: '{{count}} የተማሪ ውጤቶች ተጠብቀው ይቆያሉ',
    resultsKeptSub: 'ሁሉም የተማሪዎች ሙከራዎች እና ነጥቦች በውጤት ገጽ ላይ ተጠብቀው ይቆያሉ።',
    forceSubmitOptionLabel: 'በሂደት ላይ ያሉትን አስገድደህ በማስረከብ ሰርዝ',
    typeTitleToConfirm: 'ለማረጋገጥ የፈተናውን ርዕስ ይጻፉ',
    deleteSuccessPreserved: 'ፈተናው ተሰርዟል። የተማሪዎች ውጤቶች ተጠብቀዋል።',
    inProgressDeleteBlocked: 'ተማሪዎች በአሁኑ ጊዜ እየተፈተኑ ነው። እባክዎ የመጀመሪያውን አስገድደህ ማስረከብ ይምረጡ።',
  },
  results: {
    emailResult: 'ውጤት በኢሜይል ላክ',
    emailedStatus: 'በኢሜይል ተልኳል',
    updatedAfterSending: 'ከተላከ በኋላ ተሻሽሏል',
    sendingEmail: 'በመላክ ላይ...',
    sendUpdatedResult: 'የተሻሻለውን ውጤት ላክ',
    examDeletedBadge: 'ፈተናው ተሰርዟል',
    deleteResultsBtn: 'ውጤቶችን ሰርዝ',
    deleteResultsConfirmTitle: 'ሁሉንም ውጤቶች ሰርዝ',
    deleteResultsNotice: 'የዚህን ፈተና ሁሉንም ውጤቶች ለማጥፋት እርግጠኛ ነዎት?',
    typeDeleteResultsToConfirm: 'ለማረጋገጥ "DELETE RESULTS" ብለው ይጻፉ:',
    downloadBackupFirst: 'የExcel ኮፒ አውርድ',
    cannotRetakeDeletedTooltip: 'ይህ ፈተና ስለተሰረዘ እንደገና መውሰድ አይቻልም።',
    downloadReportDocx: 'የውጤት ሪፖርት (.docx) አውርድ',
    noEmailTooltip: 'ተማሪው የተመዘገበ ኢሜይል የለውም',
    addEmailShortcut: 'ኢሜይል አክል',
  }
};

// Arabic versions of new keys
const newArKeys = {
  exams: {
    deletePreserveNotice: 'هل أنت تأكد من حذف الاختبار "{{title}}"? سيتم حذف تعريف الاختبار وأسئلته ورابطه بشكل دائم، بينما ستظل نتائج ودرجات الطلاب محفوظة بالكامل.',
    resultsWillBeKept: 'تم حفظ {{count}} نتيجة طالب في الأرشيف',
    resultsKeptSub: 'يمكن الاطلاع على جميع المحاولات والدرجات في صفحة النتائج.',
    forceSubmitOptionLabel: 'إنهاء وتسليم محاولات الطلاب قيد الإجراء فوراً وحذف الاختبار',
    typeTitleToConfirm: 'اكتب اسم الاختبار لتأكيد الحذف',
    deleteSuccessPreserved: 'تم حذف الاختبار بنجاح مع حفظ نتائج الطلاب.',
    inProgressDeleteBlocked: 'هناك طلاب يؤدون الاختبار حالياً. اختر إنهاء تسليم محاولاتهم أولاً.',
  },
  results: {
    emailResult: 'إرسال النتيجة بالبريد',
    emailedStatus: 'تم الإرسال بالبريد',
    updatedAfterSending: 'تم التحديث بعد الإرسال',
    sendingEmail: 'جاري الإرسال...',
    sendUpdatedResult: 'إرسال النتيجة المحدثة',
    examDeletedBadge: 'تم حذف الاختبار',
    deleteResultsBtn: 'حذف جميع النتائج',
    deleteResultsConfirmTitle: 'تأكيد حذف جميع النتائج',
    deleteResultsNotice: 'هل أنت تأكد من حذف جميع نتائج هذا الاختبار؟',
    typeDeleteResultsToConfirm: 'اكتب "DELETE RESULTS" لتأكيد الحذف:',
    downloadBackupFirst: 'تحميل نسخة احتياطية Excel أولاً',
    cannotRetakeDeletedTooltip: 'تم حذف هذا الاختبار ولا يمكن إعادة محاولته.',
    downloadReportDocx: 'تحميل تقرير النتيجة (.docx)',
    noEmailTooltip: 'لا يوجد بريد إلكتروني مسجل للطالب',
    addEmailShortcut: 'إضافة بريد',
  }
};

function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else if (target[key] === undefined) {
      target[key] = source[key];
    }
  }
}

deepMerge(en, newKeys);
deepMerge(am, newKeys); // Base fallback
deepMerge(am, newAmKeys);
deepMerge(ar, newKeys); // Base fallback
deepMerge(ar, newArKeys);

// Copy any missing keys from EN to AM and AR
function fillMissingFromEn(sourceObj, targetObj, lang = 'am') {
  for (const key in sourceObj) {
    if (typeof sourceObj[key] === 'object' && sourceObj[key] !== null) {
      if (!targetObj[key]) targetObj[key] = {};
      fillMissingFromEn(sourceObj[key], targetObj[key], lang);
    } else {
      if (targetObj[key] === undefined) {
        targetObj[key] = sourceObj[key];
      }
    }
  }
}

fillMissingFromEn(en, am, 'am');
fillMissingFromEn(en, ar, 'ar');

fs.writeFileSync(enPath, JSON.stringify(en, null, 2), 'utf-8');
fs.writeFileSync(amPath, JSON.stringify(am, null, 2), 'utf-8');
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2), 'utf-8');

console.log('✅ Synchronized all translation keys across en.json, am.json, ar.json');
