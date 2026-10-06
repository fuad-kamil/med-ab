import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';
import { Button } from '../../components/Button';
import { Input, Select, Textarea } from '../../components/Input';
import { Modal, ConfirmDialog } from '../../components/Modal';
import { LoadingScreen } from '../../components/Spinner';
import { ErrorState, Badge } from '../../components/Common';
import { useToast } from '../../components/Toast';
import { Trash2, ArrowUp, ArrowDown, Plus, Sparkles, Clock } from 'lucide-react';
import AiAssistantDrawer from '../../components/admin/AiAssistantDrawer';

const QUESTION_TYPES = [
  { value: 'mcq_single', label: 'Multiple Choice (Single Answer)' },
  { value: 'mcq_multi', label: 'Multiple Choice (Multiple Answers)' },
  { value: 'true_false', label: 'True / False' },
  { value: 'short_answer', label: 'Short Answer' },
];

const SAMPLE_PASTE_FORMAT = `1. What is the first pillar of Islam?
A) Shahada *
B) Salah
C) Zakat
D) Sawm

2. መሬት በፀሐይ ዙሪያ ትዞራለች።
A) እውነት *
B) ሐሰት

3. Write a short explanation about the Importance of Tawheed.`;

function parseHumanTextQuestions(rawText) {
  const trimmed = rawText.trim();
  if (!trimmed) throw new Error('Pasting space is empty. Please enter question text.');

  // JSON fallback
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      return list.map((q, idx) => {
        if (!q.text) throw new Error(`Question ${idx + 1} is missing "text" field`);
        const type = q.type || 'mcq_single';
        const rawOptions = q.options || [];
        const formattedOptions = rawOptions.map((opt) =>
          typeof opt === 'string' ? { text: opt } : opt
        );
        return {
          text: q.text,
          type,
          marks: Number(q.marks) || 1,
          options: formattedOptions,
          correctAnswer: q.correctAnswer || (formattedOptions[0] ? formattedOptions[0].id || formattedOptions[0].text : ''),
          explanation: q.explanation || '',
        };
      });
    } catch (e) {
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        throw new Error(`Invalid JSON format: ${e.message}`);
      }
    }
  }

  // CSV fallback
  if (trimmed.toLowerCase().includes('question,') && trimmed.toLowerCase().includes('option a')) {
    const csvLines = trimmed.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim());
    if (csvLines.length > 1) {
      const csvQuestions = [];
      for (let i = 1; i < csvLines.length; i++) {
        const line = csvLines[i].trim();
        if (!line) continue;
        const matches = [...line.matchAll(/(?:^|,)(?:"([^"]*)"|([^,]*))/g)];
        const fields = matches.map((m) => (m[1] !== undefined ? m[1] : m[2] || '').trim());
        if (fields.length >= 6 && fields[0]) {
          const qText = fields[0];
          const rawOpts = [fields[1], fields[2], fields[3], fields[4]].filter(Boolean);
          const correctOptStr = fields[5] || 'Option A';
          const exp = fields[6] || '';
          const marks = Number(fields[7]) || 2;

          const options = rawOpts.map((optText, idx) => ({
            id: crypto.randomUUID(),
            text: optText,
            label: String.fromCharCode(65 + idx),
          }));

          let correctIdx = 0;
          if (/Option\s*B/i.test(correctOptStr) || /^B$/i.test(correctOptStr)) correctIdx = 1;
          else if (/Option\s*C/i.test(correctOptStr) || /^C$/i.test(correctOptStr)) correctIdx = 2;
          else if (/Option\s*D/i.test(correctOptStr) || /^D$/i.test(correctOptStr)) correctIdx = 3;

          csvQuestions.push({
            text: qText,
            type: 'mcq_single',
            marks,
            options,
            correctAnswer: options[correctIdx] ? options[correctIdx].id : (options[0]?.id || ''),
            explanation: exp,
          });
        }
      }
      if (csvQuestions.length > 0) return csvQuestions;
    }
  }

  // Parse plain text / Word copy-paste format
  const normalizedText = trimmed.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedText.split('\n');

  const questionBlocks = [];
  let currentBlock = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue; // Ignore empty lines inside a question block instead of splitting it

    const isNewHeader = /^(?:Q\d+[:.]?|\d+[\.)]|ጥያቄ\s*\d+[:.]?|Question\s*\d+[:.]?)\s+/i.test(l);
    if (isNewHeader && currentBlock.length > 0) {
      questionBlocks.push(currentBlock.join('\n'));
      currentBlock = [l];
    } else {
      currentBlock.push(l);
    }
  }

  if (currentBlock.length > 0) {
    questionBlocks.push(currentBlock.join('\n'));
  }

  if (questionBlocks.length === 0) {
    throw new Error('No questions found in pasted text');
  }

  const parsedQuestions = [];

  for (let b = 0; b < questionBlocks.length; b++) {
    const block = questionBlocks[b];
    const blockLines = block.split('\n').map((str) => str.trim()).filter(Boolean);
    if (blockLines.length === 0) continue;

    let questionText = blockLines[0].replace(/^(?:Q\d+[:.]?|\d+[\.)]|ጥያቄ\s*\d+[:.]?|Question\s*\d+[:.]?)\s+/i, '').trim();
    let rawOptions = [];
    let explicitCorrectAnswer = '';
    let explanation = '';
    let marks = 1;
    let explicitType = '';

    for (let i = 1; i < blockLines.length; i++) {
      const line = blockLines[i];

      const typeMatch = line.match(/^(?:Type|ዓይነት)[:\s]+(.+)/i);
      if (typeMatch) {
        const val = typeMatch[1].trim().toLowerCase();
        if (val.includes('short') || val.includes('አጭር')) explicitType = 'short_answer';
        else if (val.includes('true') || val.includes('እውነት')) explicitType = 'true_false';
        else if (val.includes('multi')) explicitType = 'mcq_multi';
        else explicitType = 'mcq_single';
        continue;
      }

      const ansMatch = line.match(/^(?:Answer|Ans|Correct|Correct Answer|መልስ|ትክክለኛ መልስ)[:\s]+(.+)/i);
      if (ansMatch) {
        explicitCorrectAnswer = ansMatch[1].trim();
        continue;
      }

      const expMatch = line.match(/^(?:Explanation|Rationale|Note|ማብራሪያ)[:\s]+(.+)/i);
      if (expMatch) {
        explanation = expMatch[1].trim();
        continue;
      }

      const marksMatch = line.match(/^(?:Marks|Points|Score|ነጥብ)[:\s]+([\d.]+)/i);
      if (marksMatch) {
        marks = Number(marksMatch[1]) || 1;
        continue;
      }

      const isExplicitOption = /^(?:[A-Za-z0-9]|ሀ|ለ|ሐ|መ)[\.\)]\s+/.test(line);

      if (isExplicitOption) {
        const labelMatch = line.match(/^([A-Za-z0-9]|ሀ|ለ|ሐ|መ)/);
        const label = labelMatch ? labelMatch[1].toUpperCase() : '';
        let optText = line.replace(/^(?:[A-Za-z0-9]|ሀ|ለ|ሐ|መ)[\.\)]\s+/, '').trim();
        const isStarred = optText.includes('*');
        if (isStarred) {
          optText = optText.replace(/\*/g, '').trim();
        }
        rawOptions.push({ label, text: optText, isCorrect: isStarred });
      } else if (rawOptions.length === 0 && !explicitCorrectAnswer && !explanation && !explicitType) {
        questionText += ' ' + line;
      }
    }

    const starredOptionCount = rawOptions.filter((o) => o.isCorrect).length;
    let type = explicitType;
    if (!type) {
      if (rawOptions.length === 0) {
        type = 'short_answer';
      } else if (starredOptionCount > 1) {
        type = 'mcq_multi';
      } else if (
        rawOptions.length === 2 &&
        rawOptions.some((o) => /^(true|እውነት)$/i.test(o.text.trim())) &&
        rawOptions.some((o) => /^(false|ሐሰት|ሀሰት)$/i.test(o.text.trim()))
      ) {
        type = 'true_false';
      } else {
        type = 'mcq_single';
      }
    }

    const finalOptions = rawOptions.map((o) => ({
      id: crypto.randomUUID(),
      text: o.text,
      label: o.label,
      isCorrect: o.isCorrect,
    }));

    let finalCorrectAnswer = '';
    if (type === 'mcq_multi') {
      const correctIds = finalOptions.filter((o) => o.isCorrect).map((o) => o.id);
      if (correctIds.length > 0) {
        finalCorrectAnswer = correctIds;
      } else if (explicitCorrectAnswer) {
        finalCorrectAnswer = finalOptions.map((o) => o.id);
      }
    } else if (type === 'mcq_single' || type === 'true_false') {
      const starred = finalOptions.find((o) => o.isCorrect);
      if (starred) {
        finalCorrectAnswer = starred.id;
      } else if (explicitCorrectAnswer) {
        const byLabel = finalOptions.find(
          (o) => o.label && o.label.toUpperCase() === explicitCorrectAnswer.toUpperCase()
        );
        if (byLabel) {
          finalCorrectAnswer = byLabel.id;
        } else {
          const byText = finalOptions.find(
            (o) => o.text.toLowerCase() === explicitCorrectAnswer.toLowerCase() ||
                   (explicitCorrectAnswer.toLowerCase() === 'true' && /እውነት/i.test(o.text)) ||
                   (explicitCorrectAnswer.toLowerCase() === 'false' && /(ሐሰት|ሀሰት)/i.test(o.text))
          );
          if (byText) {
            finalCorrectAnswer = byText.id;
          } else if (finalOptions.length > 0) {
            finalCorrectAnswer = finalOptions[0].id;
          }
        }
      } else if (finalOptions.length > 0) {
        finalCorrectAnswer = finalOptions[0].id;
      }
    } else {
      finalCorrectAnswer = explicitCorrectAnswer;
    }

    parsedQuestions.push({
      text: questionText,
      type,
      marks,
      options: finalOptions.map(({ id, text }) => ({ id, text })),
      correctAnswer: finalCorrectAnswer,
      explanation,
    });
  }

  if (parsedQuestions.length === 0) {
    throw new Error('Could not extract questions. Please check the sample format rule.');
  }

  return parsedQuestions;
}

export default function ExamEditor() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const { addToast, ToastContainer } = useToast();
  const fileInputRef = useRef(null);
  const qTextRef = useRef(null);

  // Exam data
  const [exam, setExam] = useState({
    title: '',
    description: '',
    durationMinutes: 60,
    shuffleQuestions: false,
    shuffleOptions: false,
    passMark: '',
    closeAction: 'block_new',
    language: 'en',
    allowedStudents: [],
    categoryId: '',
  });
  const [categories, setCategories] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Question editor
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [qForm, setQForm] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [deleteQuestion, setDeleteQuestion] = useState(null);
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Bulk import state
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  const [importingQuestions, setImportingQuestions] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [previewQuestions, setPreviewQuestions] = useState([]);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);

  // Fetch exam and questions
  const fetchExam = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const [examRes, qRes] = await Promise.all([
        api.get(`/api/exams/${id}`),
        api.get(`/api/exams/${id}/questions`),
      ]);
      const e = examRes.data.exam;
      setExam({
        title: e.title,
        description: e.description || '',
        durationMinutes: e.durationMinutes,
        shuffleQuestions: e.shuffleQuestions,
        shuffleOptions: e.shuffleOptions,
        passMark: e.passMark ?? '',
        closeAction: e.closeAction,
        language: e.language || 'en',
        allowedStudents: (e.allowedStudents || []).map((s) =>
          typeof s === 'object' && s !== null ? s._id : String(s)
        ),
        categoryId: e.categoryId ? (typeof e.categoryId === 'object' ? e.categoryId._id : e.categoryId) : '',
        _id: e._id,
        accessToken: e.accessToken,
        status: e.status,
        questionCount: e.questionCount,
        attemptCount: e.attemptCount,
      });
      setQuestions(qRes.data.questions || []);
    } catch (err) {
      setError(err.response?.data?.error || t('errors.GENERIC'));
    } finally {
      setLoading(false);
    }
  }, [id, isNew, t]);

  const handleAddExtraTime = async () => {
    if (isNew) {
      setExam((prev) => ({ ...prev, durationMinutes: (Number(prev.durationMinutes) || 0) + 5 }));
      addToast(t('exams.addedFiveMinSuccess', { title: exam.title || 'Exam' }), 'success');
      return;
    }
    try {
      const { data } = await api.post(`/api/exams/${id}/add-time`, { minutes: 5 });
      setExam((prev) => ({ ...prev, durationMinutes: data.durationMinutes }));
      addToast(t('exams.addedFiveMinSuccess', { title: exam.title }), 'success');
    } catch (err) {
      addToast(err.response?.data?.error || t('errors.GENERIC'), 'error');
    }
  };

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/api/categories');
      setCategories(res.data?.categories || []);
    } catch {
      // ignore
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await api.get('/api/users?limit=1000');
      setStudents(res.data?.users || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchStudents();
    fetchExam();
  }, [fetchCategories, fetchStudents, fetchExam]);

  // Live preview update when bulk text changes
  useEffect(() => {
    if (!bulkImportText.trim()) {
      setPreviewQuestions([]);
      setBulkError('');
      return;
    }
    try {
      const parsed = parseHumanTextQuestions(bulkImportText);
      setPreviewQuestions(parsed);
      setBulkError('');
    } catch (err) {
      setPreviewQuestions([]);
      setBulkError(err.message);
    }
  }, [bulkImportText]);

  // Save exam settings
  const saveExam = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: exam.title,
        description: exam.description,
        durationMinutes: Number(exam.durationMinutes),
        shuffleQuestions: exam.shuffleQuestions,
        shuffleOptions: exam.shuffleOptions,
        passMark: exam.passMark !== '' ? Number(exam.passMark) : null,
        closeAction: exam.closeAction,
        language: exam.language || 'en',
        allowedStudents: exam.allowedStudents || [],
        categoryId: exam.categoryId || null,
      };

      if (isNew) {
        const { data } = await api.post('/api/exams', payload);
        addToast(t('common.save') + ' success', 'success');
        navigate(`/admin/exams/${data.exam._id}`, { replace: true });
      } else {
        await api.put(`/api/exams/${id}`, payload);
        addToast(t('common.saveChanges') + ' success', 'success');
        fetchExam();
      }
    } catch (err) {
      addToast(err.response?.data?.error || t('errors.GENERIC'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Question CRUD
  const openQuestionEditor = (question = null) => {
    setFormErrors({});
    setShowExplanation(!!question?.explanation);
    if (question) {
      setEditingQuestion(question._id);
      setQForm({
        type: question.type,
        text: question.text,
        options: question.options || [],
        correctAnswer: question.correctAnswer,
        marks: question.marks || 1,
        explanation: question.explanation || '',
      });
    } else {
      setEditingQuestion('new');
      setQForm({
        type: 'mcq_single',
        text: '',
        options: [
          { id: crypto.randomUUID(), text: '' },
          { id: crypto.randomUUID(), text: '' },
        ],
        correctAnswer: '',
        marks: 1,
        explanation: '',
      });
    }
  };

  // Option reordering helpers
  const moveOptionUp = (idx) => {
    if (idx === 0 || !qForm) return;
    const newOpts = [...qForm.options];
    [newOpts[idx - 1], newOpts[idx]] = [newOpts[idx], newOpts[idx - 1]];
    setQForm({ ...qForm, options: newOpts });
  };

  const moveOptionDown = (idx) => {
    if (!qForm || idx === qForm.options.length - 1) return;
    const newOpts = [...qForm.options];
    [newOpts[idx + 1], newOpts[idx]] = [newOpts[idx], newOpts[idx + 1]];
    setQForm({ ...qForm, options: newOpts });
  };

  // Validate Question Form
  const validateForm = () => {
    const errors = {};
    if (!qForm?.text?.trim()) {
      errors.text = 'Question text is required';
    }

    if (['mcq_single', 'mcq_multi', 'true_false'].includes(qForm.type)) {
      if (!qForm.options || qForm.options.length < 2) {
        errors.options = 'At least 2 options are required';
      } else if (qForm.options.some((o) => !o.text.trim())) {
        errors.options = 'All option text fields must be filled';
      }

      if (qForm.type === 'mcq_multi') {
        if (!Array.isArray(qForm.correctAnswer) || qForm.correctAnswer.length === 0) {
          errors.correctAnswer = 'Please check at least one correct option';
        }
      } else {
        if (!qForm.correctAnswer) {
          errors.correctAnswer = 'Please select the correct answer';
        }
      }
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      // Focus first invalid element
      setTimeout(() => {
        if (errors.text) {
          const el = document.getElementById('q-text');
          el?.focus();
        } else if (errors.options || errors.correctAnswer) {
          const el = document.getElementById('q-opt-0');
          el?.focus();
        }
      }, 50);
      return false;
    }
    return true;
  };

  // Save Question Action (supports keepOpenAndReset for "Add & New")
  const saveQuestion = async (e, keepOpenAndReset = false) => {
    if (e) e.preventDefault();
    if (!validateForm()) return;

    setSavingQuestion(true);
    try {
      const payload = { ...qForm };

      if (payload.type === 'true_false') {
        payload.options = [
          { id: payload.options[0]?.id || crypto.randomUUID(), text: 'True' },
          { id: payload.options[1]?.id || crypto.randomUUID(), text: 'False' },
        ];
      }

      if (editingQuestion === 'new') {
        await api.post(`/api/exams/${id}/questions`, payload);
        addToast(t('exams.addQuestion') + ' success', 'success');
      } else {
        await api.put(`/api/exams/${id}/questions/${editingQuestion}`, payload);
        addToast(t('common.saveChanges') + ' success', 'success');
      }

      await fetchExam();

      if (keepOpenAndReset) {
        // Reset form for next question & keep modal open
        setQForm({
          type: qForm.type, // keep same type & points for speed
          text: '',
          options: [
            { id: crypto.randomUUID(), text: '' },
            { id: crypto.randomUUID(), text: '' },
          ],
          correctAnswer: '',
          marks: qForm.marks,
          explanation: '',
        });
        setFormErrors({});
        setShowExplanation(false);
        setTimeout(() => {
          qTextRef.current?.focus();
        }, 50);
      } else {
        setEditingQuestion(null);
        setQForm(null);
      }
    } catch (err) {
      addToast(err.response?.data?.error || t('errors.GENERIC'), 'error');
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!deleteQuestion) return;
    const targetId = deleteQuestion;
    setDeleteQuestion(null);
    try {
      await api.delete(`/api/exams/${id}/questions/${targetId}`);
      addToast(t('common.delete') + ' success', 'success');
      fetchExam();
    } catch (err) {
      addToast(err.response?.data?.error || t('errors.GENERIC'), 'error');
    }
  };

  // Option helpers
  const addOption = () => {
    const newId = crypto.randomUUID();
    setQForm({
      ...qForm,
      options: [...qForm.options, { id: newId, text: '' }],
    });
    setTimeout(() => {
      const idx = qForm.options.length;
      document.getElementById(`q-opt-${idx}`)?.focus();
    }, 50);
  };

  const removeOption = (index) => {
    const newOpts = qForm.options.filter((_, i) => i !== index);
    setQForm({ ...qForm, options: newOpts });
  };

  const updateOptionText = (index, text) => {
    const newOpts = [...qForm.options];
    newOpts[index] = { ...newOpts[index], text };
    setQForm({ ...qForm, options: newOpts });
  };

  // File Upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (content && typeof content === 'string') {
        setBulkImportText(content);
      }
    };
    reader.readAsText(file);
  };

  // Bulk Import Submit
  const handleBulkImportQuestions = async (e) => {
    e.preventDefault();
    setBulkError('');
    setImportingQuestions(true);

    try {
      const parsedQuestions = parseHumanTextQuestions(bulkImportText);
      const { data } = await api.post(`/api/exams/${id}/questions/import`, {
        questions: parsedQuestions,
      });

      addToast(`Successfully imported ${data.imported || parsedQuestions.length} question(s)`, 'success');
      setShowBulkImportModal(false);
      setBulkImportText('');
      setPreviewQuestions([]);
      fetchExam();
    } catch (err) {
      setBulkError(err.response?.data?.error || err.message || 'Import failed');
    } finally {
      setImportingQuestions(false);
    }
  };

  const copySampleText = () => {
    setBulkImportText(SAMPLE_PASTE_FORMAT);
    addToast(t('common.copied'), 'info');
  };

  const copyLink = () => {
    const url = `${window.location.origin}/exam/${exam.accessToken}`;
    navigator.clipboard.writeText(url).then(() => addToast(t('common.copied'), 'info'));
  };

  const regenerateLink = async () => {
    try {
      await api.patch(`/api/exams/${id}/regenerate-token`);
      addToast(t('exams.regenerateConfirm'), 'info');
      fetchExam();
    } catch (err) {
      addToast(t('errors.GENERIC'), 'error');
    }
  };

  const toggleStatus = async () => {
    const newStatus = exam.status === 'open' ? 'closed' : 'open';
    try {
      await api.patch(`/api/exams/${id}/status`, { status: newStatus });
      addToast(newStatus === 'open' ? t('exams.openExam') : t('exams.closeExam'), 'success');
      fetchExam();
    } catch (err) {
      addToast(err.response?.data?.error || t('errors.GENERIC'), 'error');
    }
  };

  if (loading) return <LoadingScreen message={t('common.loading')} />;
  if (error) return <ErrorState message={error} onRetry={fetchExam} />;

  return (
    <div className="animate-fade-in max-w-4xl pb-16 space-y-6">
      <ToastContainer />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/exams')}
            className="p-2 rounded-xl border border-surface-200 dark:border-surface-700 hover:bg-surface-200 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300 transition-colors cursor-pointer text-sm font-medium"
          >
            ← {t('common.back')}
          </button>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
              {isNew ? t('exams.createExam') : t('exams.editExam')}
            </h1>
            {!isNew && exam.status && (
              <Badge variant={exam.status === 'open' ? 'success' : exam.status === 'draft' ? 'default' : 'danger'} className="mt-1">
                {t(`common.${exam.status}`)}
              </Badge>
            )}
          </div>
        </div>

        {!isNew && (
          <Button
            variant={exam.status === 'open' ? 'danger' : 'success'}
            onClick={toggleStatus}
            disabled={exam.status === 'draft' && questions.length === 0}
          >
            {exam.status === 'open' ? t('exams.closeExam') : t('exams.openExam')}
          </Button>
        )}
      </div>

      {/* Shareable Link Control — only for existing exams */}
      {!isNew && (
        <div className="glass-card p-4 rounded-2xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-900/60 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-surface-500 mb-1">{t('exams.shareableLink')}</p>
              <p className="text-sm font-mono text-primary-600 dark:text-primary-400 truncate font-semibold">
                {`${window.location.origin}/exam/${exam.accessToken}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={copyLink}>
                📋 {t('common.copy')}
              </Button>
              <Button variant="ghost" size="sm" onClick={regenerateLink}>
                🔄 {t('exams.regenerateLink')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Exam Settings Form (Responsive Grid) */}
      <form onSubmit={saveExam} className="glass-card p-5 sm:p-6 space-y-5 rounded-2xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-900/60 shadow-sm">
        <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100 border-b border-surface-200 dark:border-surface-800 pb-3">
          Exam Settings
        </h2>

        <Input
          label={t('exams.examTitle')}
          value={exam.title}
          onChange={(e) => setExam({ ...exam, title: e.target.value })}
          placeholder="e.g. Tajweed Final Exam"
          required
          id="exam-title"
        />

        <Textarea
          label="Description / Instructions"
          value={exam.description}
          onChange={(e) => setExam({ ...exam, description: e.target.value })}
          placeholder="Instructions shown to students before starting..."
          id="exam-description"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label={t('exams.duration') + ' (minutes)'}
                type="number"
                value={exam.durationMinutes}
                onChange={(e) => setExam({ ...exam, durationMinutes: e.target.value })}
                min={1}
                max={480}
                required
                id="exam-duration"
              />
            </div>
            <button
              type="button"
              onClick={handleAddExtraTime}
              title={t('exams.addFiveMinTooltip')}
              className="h-[44px] px-3.5 py-2 mb-[2px] rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:border-amber-500/60 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer flex-shrink-0"
            >
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>5+</span>
            </button>
          </div>
          <Input
            label={t('exams.passMark') + ' (%)'}
            type="number"
            value={exam.passMark}
            onChange={(e) => setExam({ ...exam, passMark: e.target.value })}
            min={0}
            max={100}
            placeholder={t('common.optional')}
            id="exam-pass-mark"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select
            label={t('exams.examLanguage')}
            value={exam.language}
            onChange={(e) => setExam({ ...exam, language: e.target.value })}
            id="exam-language-select"
          >
            <option value="en">🇬🇧 English</option>
            <option value="am">🇪🇹 አማርኛ (Amharic)</option>
            <option value="ar">🇸🇦 العربية (Arabic)</option>
          </Select>

          <Select
            label={t('exams.closeAction')}
            value={exam.closeAction}
            onChange={(e) => setExam({ ...exam, closeAction: e.target.value })}
            id="exam-close-action"
          >
            <option value="block_new">{t('exams.blockNew')}</option>
            <option value="force_submit">{t('exams.forceSubmit')}</option>
          </Select>

          <Select
            label={t('exams.filterByCategory')}
            value={exam.categoryId}
            onChange={(e) => setExam({ ...exam, categoryId: e.target.value })}
            id="exam-category"
          >
            <option value="">-- {t('exams.allCategories')} --</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-6 pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-surface-700 dark:text-surface-300">
            <input
              type="checkbox"
              checked={exam.shuffleQuestions}
              onChange={(e) => setExam({ ...exam, shuffleQuestions: e.target.checked })}
              className="rounded accent-primary-600"
            />
            <span>{t('exams.shuffleQuestions') || 'Shuffle questions'}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-surface-700 dark:text-surface-300">
            <input
              type="checkbox"
              checked={exam.shuffleOptions}
              onChange={(e) => setExam({ ...exam, shuffleOptions: e.target.checked })}
              className="rounded accent-primary-600"
            />
            <span>{t('exams.shuffleOptions') || 'Shuffle options'}</span>
          </label>
        </div>

        {/* Student Access Selection */}
        <div className="border-t border-surface-200 dark:border-surface-800 pt-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                <span>🎓 Allowed Students</span>
                <span className="text-xs font-normal text-surface-500">
                  ({(exam.allowedStudents || []).length === 0
                    ? 'All active students allowed'
                    : `${(exam.allowedStudents || []).length} student(s) selected`})
                </span>
              </h3>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Select which students can log in to take this exam. If none are selected, all students can take it.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const currentAllowed = exam.allowedStudents || [];
                  const allStudentIds = students.map((s) => String(s._id));
                  if (currentAllowed.length === allStudentIds.length && allStudentIds.length > 0) {
                    setExam({ ...exam, allowedStudents: [] });
                  } else {
                    setExam({ ...exam, allowedStudents: allStudentIds });
                  }
                }}
                className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
              >
                {(exam.allowedStudents || []).length === students.length && students.length > 0
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
              {(exam.allowedStudents || []).length > 0 && (
                <button
                  type="button"
                  onClick={() => setExam({ ...exam, allowedStudents: [] })}
                  className="text-xs font-medium text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:underline cursor-pointer"
                >
                  Clear Selection (Allow All)
                </button>
              )}
            </div>
          </div>

          <input
            type="text"
            placeholder="Filter students by name or ID (e.g. STU-01)..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-surface-100"
          />

          <div className="max-h-48 overflow-y-auto border border-surface-200 dark:border-surface-800 rounded-xl p-2 space-y-1 bg-surface-50/50 dark:bg-surface-900/40">
            {students.length === 0 ? (
              <div className="text-center py-4 text-xs text-surface-500">
                No students found in the portal.
              </div>
            ) : (
              students
                .filter((s) => {
                  if (!studentSearch.trim()) return true;
                  const term = studentSearch.toLowerCase().trim();
                  return (
                    (s.fullName && s.fullName.toLowerCase().includes(term)) ||
                    (s.studentId && s.studentId.toLowerCase().includes(term))
                  );
                })
                .map((student) => {
                  const sId = String(student._id);
                  const currentAllowed = (exam.allowedStudents || []).map(String);
                  const isSelected = currentAllowed.includes(sId);
                  return (
                    <label
                      key={student._id}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-teal-500/10 border border-teal-500/30 text-teal-900 dark:text-teal-200'
                          : 'hover:bg-surface-200/50 dark:hover:bg-surface-800/50 text-surface-700 dark:text-surface-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const newAllowed = isSelected
                              ? currentAllowed.filter((id) => id !== sId)
                              : [...currentAllowed, sId];
                            setExam({ ...exam, allowedStudents: newAllowed });
                          }}
                          className="rounded accent-teal-600 cursor-pointer"
                        />
                        <span className="font-semibold text-surface-900 dark:text-surface-100">
                          {student.fullName}
                        </span>
                        {student.studentId && (
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface-200 dark:bg-surface-800 text-surface-600 dark:text-surface-400 font-normal">
                            {student.studentId}
                          </span>
                        )}
                      </div>
                      {student.categoryIds && student.categoryIds.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-200 dark:bg-surface-800 text-surface-600 dark:text-surface-400">
                          {student.categoryIds.map((c) => (typeof c === 'object' ? c.name : c)).join(', ')}
                        </span>
                      )}
                    </label>
                  );
                })
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" loading={saving} size="lg">
            {isNew ? t('exams.createExam') : t('common.saveChanges')}
          </Button>
        </div>
      </form>

      {/* Questions section — only for existing exams */}
      {!isNew && (
        <div className="glass-card p-5 sm:p-6 rounded-2xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-900/60 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-200 dark:border-surface-800">
            <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100">
              {t('exams.questionsList', { count: questions.length })}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAiDrawerOpen(true)}
                className="gap-1.5 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>AI Assistant</span>
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowBulkImportModal(true)}>
                📥 Bulk Import Text / Word
              </Button>
              <Button size="sm" onClick={() => openQuestionEditor()}>
                ➕ {t('exams.addQuestion')}
              </Button>
            </div>
          </div>

          {questions.length === 0 ? (
            <div className="text-center py-10 text-surface-500">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-sm">No questions yet. Click "Add Question" or "Bulk Import" to create questions.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div
                  key={q._id}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-100/70 dark:bg-surface-800/40 hover:bg-surface-200/50 dark:hover:bg-surface-800/80 border border-surface-200/80 dark:border-surface-700/50 transition-colors"
                >
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface-200 dark:bg-surface-700 flex items-center justify-center text-xs font-bold text-surface-700 dark:text-surface-300">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100 line-clamp-2" dir="auto">
                      {q.text}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <Badge variant="primary">
                        {QUESTION_TYPES.find((t) => t.value === q.type)?.label || q.type}
                      </Badge>
                      <span className="text-xs text-surface-500">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => openQuestionEditor(q)}
                      className="p-1.5 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 transition-colors cursor-pointer"
                      title={t('common.edit')}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setDeleteQuestion(q._id)}
                      className="p-1.5 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-950/40 text-danger-500 transition-colors cursor-pointer"
                      title={t('common.delete')}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {questions.length > 0 && (
            <div className="mt-4 pt-3 border-t border-surface-200 dark:border-surface-800 flex justify-between items-center">
              <span className="text-xs text-surface-500">{t('exams.totalQuestionsCount', { count: questions.length }) || `Total Questions: ${questions.length}`}</span>
              <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                Total Marks: {questions.reduce((sum, q) => sum + (q.marks || 1), 0)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Upgraded Question Editor Modal */}
      <Modal
        isOpen={!!editingQuestion}
        onClose={() => {
          setEditingQuestion(null);
          setQForm(null);
          setFormErrors({});
        }}
        title={editingQuestion === 'new' ? 'Add Question' : 'Edit Question'}
        description="Shortcut: Press Ctrl+Enter to save. Press Enter in options to add the next option."
        size="lg"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-surface-500 hidden sm:inline">
              Ctrl+Enter to save
            </span>
            <div className="flex items-center gap-2.5 ml-auto">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditingQuestion(null);
                  setQForm(null);
                  setFormErrors({});
                }}
              >
                {t('common.cancel')}
              </Button>

              {editingQuestion === 'new' && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={(e) => saveQuestion(e, true)}
                  loading={savingQuestion}
                  className="bg-primary-600/10 hover:bg-primary-600/20 text-primary-400 border border-primary-600/30"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Add & New</span>
                </Button>
              )}

              <Button
                type="button"
                onClick={(e) => saveQuestion(e, false)}
                loading={savingQuestion}
              >
                {editingQuestion === 'new' ? 'Add Question' : t('common.saveChanges')}
              </Button>
            </div>
          </div>
        }
      >
        {qForm && (
          <form
            onSubmit={(e) => saveQuestion(e, false)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                saveQuestion(e, false);
              }
            }}
            className="space-y-4"
          >
            {/* Row 1: Question Type & Points */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label={t('exams.questionType')}
                value={qForm.type}
                onChange={(e) => {
                  const type = e.target.value;
                  let newForm = { ...qForm, type };
                  if (type === 'true_false') {
                    newForm.options = [
                      { id: crypto.randomUUID(), text: 'True' },
                      { id: crypto.randomUUID(), text: 'False' },
                    ];
                    newForm.correctAnswer = newForm.options[0].id;
                  } else if (type === 'short_answer') {
                    newForm.options = [];
                    newForm.correctAnswer = '';
                  }
                  setQForm(newForm);
                  setFormErrors({});
                }}
                id="q-type"
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>

              <Input
                label={t('exams.points')}
                type="number"
                value={qForm.marks}
                onChange={(e) => setQForm({ ...qForm, marks: Number(e.target.value) })}
                min={0.5}
                step={0.5}
                required
                id="q-marks"
              />
            </div>

            {/* Row 2: Question Text (Autofocused) */}
            <div>
              <Textarea
                ref={qTextRef}
                label={t('exams.questionText')}
                value={qForm.text}
                onChange={(e) => {
                  setQForm({ ...qForm, text: e.target.value });
                  if (formErrors.text) setFormErrors({ ...formErrors, text: null });
                }}
                placeholder="Enter question text here..."
                required
                rows={3}
                id="q-text"
                autoFocus
              />
              {formErrors.text && (
                <p className="text-xs text-danger-500 font-medium mt-1">⚠️ {formErrors.text}</p>
              )}
            </div>

            {/* Options List for MCQ & True-False */}
            {['mcq_single', 'mcq_multi', 'true_false'].includes(qForm.type) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider">
                    Options {qForm.type !== 'true_false' && '(select correct answer)'}
                  </label>
                  {formErrors.correctAnswer && (
                    <span className="text-xs text-danger-500 font-medium">⚠️ {formErrors.correctAnswer}</span>
                  )}
                </div>

                {formErrors.options && (
                  <p className="text-xs text-danger-500 font-medium">⚠️ {formErrors.options}</p>
                )}

                <div className="space-y-2">
                  {qForm.options.map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-2 bg-surface-100/50 dark:bg-surface-800/40 p-2 rounded-xl border border-surface-200 dark:border-surface-700/60">
                      {/* Reorder Buttons */}
                      {qForm.type !== 'true_false' && (
                        <div className="flex flex-col shrink-0">
                          <button
                            type="button"
                            onClick={() => moveOptionUp(i)}
                            disabled={i === 0}
                            className="p-0.5 text-surface-400 hover:text-surface-100 disabled:opacity-30 cursor-pointer"
                            title="Move up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveOptionDown(i)}
                            disabled={i === qForm.options.length - 1}
                            className="p-0.5 text-surface-400 hover:text-surface-100 disabled:opacity-30 cursor-pointer"
                            title="Move down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Correct answer toggle */}
                      {qForm.type === 'mcq_multi' ? (
                        <input
                          type="checkbox"
                          checked={Array.isArray(qForm.correctAnswer) && qForm.correctAnswer.includes(opt.id)}
                          onChange={() => {
                            const current = Array.isArray(qForm.correctAnswer) ? qForm.correctAnswer : [];
                            const updated = current.includes(opt.id)
                              ? current.filter((id) => id !== opt.id)
                              : [...current, opt.id];
                            setQForm({ ...qForm, correctAnswer: updated });
                            setFormErrors({ ...formErrors, correctAnswer: null });
                          }}
                          className="accent-primary-600 w-4 h-4 cursor-pointer shrink-0"
                          title="Check if correct option"
                        />
                      ) : (
                        <input
                          type="radio"
                          name="correct-answer"
                          checked={qForm.correctAnswer === opt.id}
                          onChange={() => {
                            setQForm({ ...qForm, correctAnswer: opt.id });
                            setFormErrors({ ...formErrors, correctAnswer: null });
                          }}
                          className="accent-primary-600 w-4 h-4 cursor-pointer shrink-0"
                          title="Select as correct option"
                        />
                      )}

                      {/* Option text input */}
                      <input
                        id={`q-opt-${i}`}
                        value={opt.text}
                        onChange={(e) => updateOptionText(i, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && qForm.type !== 'true_false') {
                            e.preventDefault();
                            if (i === qForm.options.length - 1) {
                              addOption();
                            } else {
                              document.getElementById(`q-opt-${i + 1}`)?.focus();
                            }
                          }
                        }}
                        placeholder={`Option ${i + 1}`}
                        disabled={qForm.type === 'true_false'}
                        className="flex-1 px-3 py-2 text-sm rounded-xl bg-surface-50 dark:bg-surface-900 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:border-primary-500"
                        dir="auto"
                      />

                      {/* Trash Delete Option Button */}
                      {qForm.type !== 'true_false' && qForm.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(i)}
                          className="p-1.5 rounded-lg text-surface-400 hover:text-danger-400 hover:bg-danger-500/10 cursor-pointer transition-colors shrink-0"
                          title="Delete option"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {qForm.type !== 'true_false' && (
                  <button
                    type="button"
                    onClick={addOption}
                    className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer flex items-center gap-1 pt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('exams.addOption')}</span>
                  </button>
                )}
              </div>
            )}

            {/* Short answer notice */}
            {qForm.type === 'short_answer' && (
              <div className="p-3.5 rounded-xl bg-surface-100/70 dark:bg-surface-800/40 border border-surface-200 dark:border-surface-700/60 text-xs text-surface-600 dark:text-surface-300">
                {t('exams.shortAnswerNotice', { marks: qForm.marks || 1 }) || `💡 Short Answer Question: Short answer questions do not require a preset answer. Student submissions will be evaluated manually by the Ustaz from 0 to ${qForm.marks || 1} mark(s).`}
              </div>
            )}
          </form>
        )}
      </Modal>

      {/* Bulk Question Import Modal */}
      <Modal
        isOpen={showBulkImportModal}
        onClose={() => {
          setShowBulkImportModal(false);
          setBulkError('');
          setPreviewQuestions([]);
        }}
        title={t('bulkImport.title')}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowBulkImportModal(false);
                setBulkError('');
                setPreviewQuestions([]);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleBulkImportQuestions}
              loading={importingQuestions}
              disabled={previewQuestions.length === 0}
            >
              {t('bulkImport.importBtn', { count: previewQuestions.length || '' })}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleBulkImportQuestions} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-surface-500 pb-2 border-b border-surface-200 dark:border-surface-800">
            <p>{t('bulkImport.sub')}</p>
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept=".txt,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-surface-700 dark:text-surface-300 font-medium hover:underline cursor-pointer"
              >
                {t('bulkImport.loadFile')}
              </button>
              <button
                type="button"
                onClick={copySampleText}
                className="text-xs text-primary-600 dark:text-primary-400 font-medium hover:underline cursor-pointer"
              >
                {t('bulkImport.sampleFormat')}
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-100 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700 text-xs text-surface-600 dark:text-surface-300 font-mono space-y-1">
            <p className="font-bold text-surface-900 dark:text-surface-100 font-sans">{t('bulkImport.formatRuleTitle')}</p>
            <p>{t('bulkImport.rule1')}</p>
            <p>{t('bulkImport.rule2')}</p>
          </div>

          <textarea
            value={bulkImportText}
            onChange={(e) => setBulkImportText(e.target.value)}
            placeholder={t('bulkImport.placeholder')}
            className="w-full h-52 px-4 py-3 text-xs font-mono rounded-xl bg-surface-100 dark:bg-surface-900 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:border-primary-500 resize-y"
            required
          />

          {bulkError && (
            <div className="p-3 rounded-xl bg-danger-500/10 border border-danger-500/30 text-danger-600 dark:text-danger-400 text-xs font-mono">
              ⚠️ {bulkError}
            </div>
          )}

          {previewQuestions.length > 0 && (
            <div className="p-3 rounded-xl bg-success-500/10 border border-success-500/30 text-xs text-success-700 dark:text-success-400 font-medium">
              {t('bulkImport.readyToImport', { count: previewQuestions.length })}
            </div>
          )}
        </form>
      </Modal>

      {/* Delete Question Confirm */}
      <ConfirmDialog
        isOpen={!!deleteQuestion}
        onClose={() => setDeleteQuestion(null)}
        onConfirm={handleDeleteQuestion}
        title={t('common.delete')}
        message="Are you sure you want to delete this question? This cannot be undone."
        confirmText={t('common.delete')}
      />

      <AiAssistantDrawer
        isOpen={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        onInsertCsv={(csvText) => {
          setBulkImportText(csvText);
          setShowBulkImportModal(true);
        }}
      />
    </div>
  );
}
