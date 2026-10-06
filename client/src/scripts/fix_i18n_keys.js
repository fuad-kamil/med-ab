import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.resolve(__dirname, '../locales');

const enFile = path.join(localesDir, 'en.json');
const amFile = path.join(localesDir, 'am.json');

const en = JSON.parse(fs.readFileSync(enFile, 'utf8'));
const am = JSON.parse(fs.readFileSync(amFile, 'utf8'));

// Helper to safely set nested key
function setKey(obj, pathStr, value) {
  const parts = pathStr.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

// Keys to add / update
const additionsEn = {
  'admin.collapseSidebar': 'Collapse sidebar',
  'admin.expandSidebar': 'Expand sidebar',
  'ai.summaryAttention': '{{count}} need attention',
  'ai.summaryCount': 'Found {{count}} questions',
  'common.attempts': '{{count}} attempts',
  'common.connected': 'Connected to server',
  'common.connectingToServer': 'Connecting to server...',
  'common.goHome': 'Go to Dashboard',
  'common.questions': '{{count}} questions',
  'common.retry': 'Retry',
  'common.wakingUpServer': 'Waking up the server, this can take up to a minute...',
  'common.wakingUpSub': 'Please wait while we establish a secure connection...',
  'dashboard.pendingGrade': 'Pending grading',
  'errors.failedToLoad': 'Failed to load data',
  'errors.pageNotFound': 'Page not found',
  'exam.examClosed': 'This exam is currently closed.',
  'exam.submittedTitle': 'Exam Submitted Successfully',
  'exams.shortAnswerNotice': 'Short-answer questions require manual review.',
  'exams.totalExams': '{{count}} total exams',
  'exams.totalQuestionsCount': '{{count}} questions',
  'students.actions': 'Actions',
  'students.attemptStatus': 'Attempt Status',
  'students.exam': 'Exam',
  'students.filters': 'Filters',
  'students.foundResults': 'Found {{count}} results',
  'students.none': 'None',
  'students.retake': 'Allow Retake',
  'students.score': 'Score',
  'students.scoreResult': 'Score Result',
  'students.submitted': 'Submitted',
  'students.unsavedWarning': 'You have unsaved changes.',
  
  // Exams list redesign keys
  'exams.showingCount': 'Showing {{shown}} of {{total}} exams',
  'exams.searchPlaceholder': 'Search exams by title or category...',
  'exams.allStatus': 'All Statuses',
  'exams.openStatus': 'Open',
  'exams.draftStatus': 'Draft',
  'exams.closedStatus': 'Closed',
  'exams.scheduledStatus': 'Scheduled',
  'exams.endedStatus': 'Ended',
  'exams.sortNewest': 'Newest first',
  'exams.sortOldest': 'Oldest first',
  'exams.sortTitleAZ': 'Title A–Z',
  'exams.sortSubmissions': 'Most submissions',
  'exams.sortClosingSoon': 'Closing soon',
  'exams.clearFilters': 'Clear filters',
  'exams.clearSearch': 'Clear search',
  'exams.extendTime': 'Extend time...',
  'exams.extendTimeDialogTitle': 'Extend Exam Time',
  'exams.extendTimeDescription': 'Add extra minutes to active students taking this exam.',
  'exams.minutesPreset': '+{{minutes}} mins',
  'exams.customMinutes': 'Custom minutes',
  'exams.scopeAll': 'All in-progress students ({{count}})',
  'exams.scopeSelected': 'Selected students',
  'exams.inProgressCountLabel': '{{count}} students currently taking the exam',
  'exams.extendSuccess': 'Added {{minutes}} minutes for {{count}} students',
  'exams.noStudentsInProgress': 'No students are currently taking this exam',
  'exams.closeLinkOptionsTitle': 'Close Exam Link',
  'exams.closeLinkOptionBlock': 'Block new starts only (allow in-progress students to finish)',
  'exams.closeLinkOptionAutoSubmit': 'Block new starts & auto-submit in-progress attempts ({{count}} active)',
  'exams.cannotOpenZeroQuestions': 'Cannot open exam with 0 questions. Add at least 1 question first.',
  'exams.deleteExamTypedTitle': 'Delete Exam "{{title}}"',
  'exams.deleteTypeToConfirm': 'This exam has {{count}} attempts. Type "{{title}}" to confirm deletion:',
  'exams.exportResultsFirst': 'Export results to Excel first',
  'exams.submittedProgress': '{{submitted}} / {{eligible}} submitted',
  'exams.inProgressBadge': '{{count}} in progress',
  'exams.scheduledOpens': 'Opens {{date}}',
  'exams.copyLinkSuccess': 'Exam link copied to clipboard!',
  'exams.regenerateLink': 'Regenerate link',
  'exams.regenerateLinkConfirm': 'Regenerating will invalidate the old link. Continue?',
  'exams.shareExam': 'Share exam',
  'exams.shareMessage': 'Exam: {{title}} - Take exam here: {{url}}',
  'exams.filtersBottomSheetTitle': 'Filter & Sort Exams',
  'exams.applyFilters': 'Apply Filters',
  'exams.activeFiltersCount': '{{count}} active'
};

const additionsAm = {
  'admin.collapseSidebar': 'ሳይድባር አጣጥፍ',
  'admin.expandSidebar': 'ሳይድባር ዘርጋ',
  'ai.summaryAttention': '{{count}} ትኩረት ያስፈልጋቸዋል',
  'ai.summaryCount': '{{count}} ጥያቄዎች ተገኝተዋል',
  'common.attempts': '{{count}} ሙከራዎች',
  'common.connected': 'ከሰርቨር ጋር ተገናኝቷል',
  'common.connectingToServer': 'ከሰርቨር ጋር በመገናኘት ላይ...',
  'common.goHome': 'ወደ ዳሽቦርድ ሂድ',
  'common.questions': '{{count}} ጥያቄዎች',
  'common.retry': 'ድጋሚ ሞክር',
  'common.wakingUpServer': 'ሰርቨሩን በማስነሳት ላይ፣ ይህ እስከ አንድ ደቂቃ ሊወስድ ይችላል...',
  'common.wakingUpSub': 'እባክዎን ደህንነቱ የተጠበቀ ግንኙነት እስኪመሠረት ድረስ ይ ጠብቁ...',
  'dashboard.pendingGrade': 'ግምገማ የሚጠብቁ',
  'errors.failedToLoad': 'መረጃ መጫን አልተቻለም',
  'errors.pageNotFound': 'ገጹ አልተገኘም',
  'exam.examClosed': 'ይህ ፈተና በአሁኑ ጊዜ ተዘጋል።',
  'exam.submittedTitle': 'ፈተናው በተሳካ ሁኔታ ተልኳል',
  'exams.shortAnswerNotice': 'አጭር መልስ ጥያቄዎች በእጅ ግምገማ ያስፈልጋቸዋል።',
  'exams.totalExams': 'በጠቅላላ {{count}} ፈተናዎች',
  'exams.totalQuestionsCount': '{{count}} ጥያቄዎች',
  'students.actions': 'እርምጃዎች',
  'students.attemptStatus': 'የሙከራ ሁኔታ',
  'students.exam': 'ፈተና',
  'students.filters': 'ማጣሪያዎች',
  'students.foundResults': '{{count}} ውጤቶች ተገኝተዋል',
  'students.none': 'ምንም',
  'students.retake': 'ድጋሚ መፈተን ፍቀድ',
  'students.score': 'ውጤት',
  'students.scoreResult': 'የውጤት ውጤት',
  'students.submitted': 'ተልኳል',
  'students.unsavedWarning': 'ያልተቀመጡ ለውጦች አሎት።',
  
  // Exams list redesign keys
  'exams.showingCount': 'ከ {{total}} ፈተናዎች {{shown}} እያሳየ ነው',
  'exams.searchPlaceholder': 'ፈተናዎችን በርእስ ወይም በካቴጎሪ ፈልግ...',
  'exams.allStatus': 'ሁሉም ሁኔታዎች',
  'exams.openStatus': 'ክፍት',
  'exams.draftStatus': 'ረቂቅ',
  'exams.closedStatus': 'የተዘጋ',
  'exams.scheduledStatus': 'የተመደበ',
  'exams.endedStatus': 'ያለቀ',
  'exams.sortNewest': 'አዲስ አስቀድሞ',
  'exams.sortOldest': 'ቆየት ያለ አስቀድሞ',
  'exams.sortTitleAZ': 'ርዕስ ሀ–ፐ',
  'exams.sortSubmissions': 'ብዙ ያስረከቡ',
  'exams.sortClosingSoon': 'በቅርቡ የሚዘጋ',
  'exams.clearFilters': 'ማጣሪያዎችን አጽዳ',
  'exams.clearSearch': 'ፍለጋን አጽዳ',
  'exams.extendTime': 'ጊዜ ጨምር...',
  'exams.extendTimeDialogTitle': 'የፈተና ጊዜ ጨምር',
  'exams.extendTimeDescription': 'ይህን ፈተና እየወሰዱ ላሉ ንቁ ተማሪዎች ተጨማሪ ደቂቃዎችን ይጨምሩ።',
  'exams.minutesPreset': '+{{minutes}} ደቂቃዎች',
  'exams.customMinutes': 'የተለየ ደቂቃ',
  'exams.scopeAll': 'ሁሉም በሂደት ላይ ያሉ ተማሪዎች ({{count}})',
  'exams.scopeSelected': 'የተመረጡ ተማሪዎች',
  'exams.inProgressCountLabel': '{{count}} ተማሪዎች በአሁኑ ጊዜ ፈተናውን እየወሰዱ ነው',
  'exams.extendSuccess': 'ለ {{count}} ተማሪዎች {{minutes}} ደቂቃዎች ተጨምረዋል',
  'exams.noStudentsInProgress': 'በአሁኑ ጊዜ ፈተናውን እየወሰደ ያለ ተማሪ የለም',
  'exams.closeLinkOptionsTitle': 'የፈተና ሊንክ ዝጋ',
  'exams.closeLinkOptionBlock': 'አዲስ እንዳይጀመር ብቻ ከልክል (በሂደት ላይ ያሉ ይጨርሱ)',
  'exams.closeLinkOptionAutoSubmit': 'አዲስ እንዳይጀመር ከልክል እና በሂደት ላይ ያሉትን በራስ-ሰር አስረክብ ({{count}} ንቁ)',
  'exams.cannotOpenZeroQuestions': '0 ጥያቄ ያለው ፈተና መክፈት አይቻልም። መጀመሪያ ቢያንስ 1 ጥያቄ ይጨምሩ።',
  'exams.deleteExamTypedTitle': "'{{title}}' ፈተና ሰርዝ",
  'exams.deleteTypeToConfirm': 'ይህ ፈተና {{count}} ሙከራዎች አሉት። ለማረጋገጥ "{{title}}" ብለው ይጻፉ:',
  'exams.exportResultsFirst': 'መጀመሪያ ውጤቶችን ወደ Excel ላክ',
  'exams.submittedProgress': '{{submitted}} / {{eligible}} ተስረክቧል',
  'exams.inProgressBadge': '{{count}} በሂደት ላይ',
  'exams.scheduledOpens': '{{date}} ይከፈታል',
  'exams.copyLinkSuccess': 'የፈተና ሊንክ ወደ clipboard ተገልብጧል!',
  'exams.regenerateLink': 'ሊንክ አዲስ ፍጠር',
  'exams.regenerateLinkConfirm': 'አዲስ ሊንክ መፍጠር አሮጌውን ውድቅ ያደርገዋል። ልቀጥል?',
  'exams.shareExam': 'ፈተና አጋራ',
  'exams.shareMessage': 'ፈተና: {{title}} - ፈተናውን እዚህ ይውሰዱ: {{url}}',
  'exams.filtersBottomSheetTitle': 'ፈተናዎችን አጣራ እና ደርድር',
  'exams.applyFilters': 'ማጣሪያዎችን ተግብር',
  'exams.activeFiltersCount': '{{count}} የነቁ'
};

for (const [key, val] of Object.entries(additionsEn)) {
  setKey(en, key, val);
}

for (const [key, val] of Object.entries(additionsAm)) {
  setKey(am, key, val);
}

fs.writeFileSync(enFile, JSON.stringify(en, null, 2) + '\n');
fs.writeFileSync(amFile, JSON.stringify(am, null, 2) + '\n');
console.log('Successfully updated en.json and am.json');
