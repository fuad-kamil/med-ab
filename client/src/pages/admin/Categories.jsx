import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api, { extractError } from '../../api/client';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Modal from '../../components/Modal';
import Spinner from '../../components/Spinner';
import Toast from '../../components/Toast';
import { EmptyState, ErrorState, Badge } from '../../components/Common';
import { Plus, Search, Edit3, Trash2, FolderOpen, Users, FileText, RefreshCw } from 'lucide-react';

export default function Categories() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  // Modal states
  const [createModal, setCreateModal] = useState(false);
  const [editCategory, setEditCategory] = useState(null);
  const [deleteCategory, setDeleteCategory] = useState(null);

  // Form states
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/categories');
      setCategories(res.data?.categories || []);
    } catch (err) {
      setError(extractError(err, 'Failed to load categories'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.name.trim()) {
      setFormError(t('categories.nameRequired'));
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/categories', formData);
      setToast({ message: t('categories.createdSuccess'), type: 'success' });
      setCreateModal(false);
      setFormData({ name: '', description: '' });
      fetchCategories();
    } catch (err) {
      setFormError(extractError(err, 'Failed to create category').message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.name.trim()) {
      setFormError(t('categories.nameRequired'));
      return;
    }

    setSubmitting(true);
    try {
      await api.put(`/api/categories/${editCategory._id}`, formData);
      setToast({ message: t('categories.updatedSuccess'), type: 'success' });
      setEditCategory(null);
      setFormData({ name: '', description: '' });
      fetchCategories();
    } catch (err) {
      setFormError(extractError(err, 'Failed to update category').message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteCategory) return;
    setSubmitting(true);
    try {
      await api.delete(`/api/categories/${deleteCategory._id}`);
      setToast({ message: t('categories.deletedSuccess'), type: 'success' });
      setDeleteCategory(null);
      fetchCategories();
    } catch (err) {
      const errRes = extractError(err, 'Failed to delete category');
      setToast({ message: errRes.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (cat) => {
    setEditCategory(cat);
    setFormData({ name: cat.name, description: cat.description || '' });
    setFormError('');
  };

  const openCreate = () => {
    setFormData({ name: '', description: '' });
    setFormError('');
    setCreateModal(true);
  };

  const filteredCategories = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-100 flex items-center gap-2">
            <FolderOpen className="w-7 h-7 text-primary-400" />
            {t('categories.title')}
          </h1>
          <p className="text-sm text-surface-400 mt-1">
            {t('categories.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={fetchCategories} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>
          <Button variant="primary" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            {t('categories.newCategory')}
          </Button>
        </div>
      </div>

      {/* Filter search bar */}
      <div className="glass-card p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t('categories.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-surface-900/60 border border-surface-700 text-surface-200 placeholder:text-surface-500 focus:outline-none focus:border-primary-500"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <ErrorState message={error.message} code={error.code} onRetry={fetchCategories} />
      ) : filteredCategories.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="w-12 h-12 text-surface-500" />}
          title={t('categories.noCategoriesTitle')}
          message={t('categories.noCategoriesMessage')}
          action={
            !search && (
              <Button variant="primary" onClick={openCreate}>
                <Plus className="w-4 h-4" />
                {t('categories.newCategory')}
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCategories.map((cat) => (
            <div
              key={cat._id}
              className="glass-card p-5 flex flex-col justify-between hover:border-surface-700 transition-all group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-surface-100 group-hover:text-primary-400 transition-colors">
                    {cat.name}
                  </h3>
                  <Badge variant="primary">{t('common.exams_other', { count: cat.examCount || 0 })}</Badge>
                </div>
                <p className="text-sm text-surface-400 line-clamp-2 min-h-[40px] mb-4">
                  {cat.description || <span className="italic text-surface-600">{t('common.none')}</span>}
                </p>
              </div>

              <div className="pt-4 border-t border-surface-800 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-surface-400">
                  <span className="flex items-center gap-1.5" title="Assigned Students">
                    <Users className="w-4 h-4 text-primary-400" />
                    {t('common.students_other', { count: cat.studentCount || 0 })}
                  </span>
                  <span className="flex items-center gap-1.5" title="Assigned Exams">
                    <FileText className="w-4 h-4 text-warning-400" />
                    {t('common.exams_other', { count: cat.examCount || 0 })}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(cat)}
                    className="p-1.5 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors cursor-pointer"
                    title={t('common.edit')}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteCategory(cat)}
                    className="p-1.5 rounded-lg text-surface-400 hover:text-danger-400 hover:bg-surface-800 transition-colors cursor-pointer"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {createModal && (
        <Modal
          isOpen={createModal}
          onClose={() => setCreateModal(false)}
          title={t('categories.createTitle')}
        >
          <form onSubmit={handleCreate} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-danger-600/10 border border-danger-600/30 text-danger-400 text-sm">
                {formError}
              </div>
            )}
            <Input
              label={`${t('categories.categoryName')} *`}
              placeholder="e.g. Computer Science, Grade 10"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              autoFocus
            />
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">
                {t('categories.description')} ({t('common.optional')})
              </label>
              <textarea
                rows={3}
                placeholder={t('categories.description')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700 text-surface-200 placeholder:text-surface-500 focus:outline-none focus:border-primary-500 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-surface-800">
              <Button variant="secondary" onClick={() => setCreateModal(false)} type="button">
                {t('common.cancel')}
              </Button>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? <Spinner size="sm" /> : t('categories.createTitle')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editCategory && (
        <Modal
          isOpen={!!editCategory}
          onClose={() => setEditCategory(null)}
          title={t('categories.editTitle')}
        >
          <form onSubmit={handleUpdate} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-danger-600/10 border border-danger-600/30 text-danger-400 text-sm">
                {formError}
              </div>
            )}
            <Input
              label={`${t('categories.categoryName')} *`}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">
                {t('categories.description')}
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700 text-surface-200 placeholder:text-surface-500 focus:outline-none focus:border-primary-500 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-surface-800">
              <Button variant="secondary" onClick={() => setEditCategory(null)} type="button">
                {t('common.cancel')}
              </Button>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? <Spinner size="sm" /> : t('common.saveChanges')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCategory && (
        <Modal
          isOpen={!!deleteCategory}
          onClose={() => setDeleteCategory(null)}
          title={t('categories.deleteTitle')}
        >
          <div className="space-y-4">
            <p className="text-sm text-surface-300">
              {t('categories.confirmDelete', { name: deleteCategory.name })}
            </p>
            {(deleteCategory.studentCount > 0 || deleteCategory.examCount > 0) && (
              <div className="p-3 rounded-xl bg-warning-600/10 border border-warning-600/30 text-warning-400 text-xs">
                ⚠️ {t('categories.deleteWarning', { students: deleteCategory.studentCount, exams: deleteCategory.examCount })}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4 border-t border-surface-800">
              <Button variant="secondary" onClick={() => setDeleteCategory(null)}>
                {t('common.cancel')}
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={submitting}>
                {submitting ? <Spinner size="sm" /> : t('categories.deleteTitle')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
