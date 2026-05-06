'use client';

import { useMemo, useState } from 'react';

const dollarsToCents = (str) => {
  const n = Number(String(str ?? '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
};

const minutesToInt = (str) => {
  const n = parseInt(String(str ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function emptyDraft(categoryId) {
  return {
    name: '',
    description: '',
    categoryId,
    durationMinutes: 30,
    priceCents: 0,
    depositCents: null,
    cancellationCents: null,
    isActive: true,
  };
}

export function ServiceEditor({ initialServices, categories }) {
  const [services, setServices] = useState(initialServices);
  const [editingId, setEditingId] = useState(null);
  const [creatingCat, setCreatingCat] = useState(null); // categoryId of the in-progress new service
  const [draft, setDraft] = useState(null);
  const [saveState, setSaveState] = useState({}); // { [id]: 'saving' | 'error' | null }
  const [saveError, setSaveError] = useState({});

  const grouped = useMemo(() => {
    return categories.map((cat) => ({
      ...cat,
      services: services.filter((s) => s.categoryId === cat.id),
    }));
  }, [services, categories]);

  const startEdit = (svc) => {
    setEditingId(svc.id);
    setCreatingCat(null);
    setDraft({
      name: svc.name,
      description: svc.description,
      categoryId: svc.categoryId,
      durationMinutes: svc.durationMinutes,
      priceCents: svc.priceCents,
      depositCents: svc.depositCents,
      cancellationCents: svc.cancellationCents,
      isActive: svc.isActive,
    });
    setSaveError((s) => ({ ...s, [svc.id]: '' }));
  };

  const startCreate = (categoryId) => {
    setEditingId('__new__');
    setCreatingCat(categoryId);
    setDraft(emptyDraft(categoryId));
    setSaveError((s) => ({ ...s, __new__: '' }));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCreatingCat(null);
    setDraft(null);
  };

  const replaceLocal = (svc) => {
    setServices((cur) => {
      const idx = cur.findIndex((s) => s.id === svc.id);
      if (idx === -1) return [...cur, svc];
      const next = cur.slice();
      next[idx] = svc;
      return next;
    });
  };

  const save = async (id) => {
    const isNew = id === '__new__';
    const url = isNew ? '/api/admin/services' : `/api/admin/services/${encodeURIComponent(id)}`;
    const method = isNew ? 'POST' : 'PATCH';

    if (!draft.name.trim()) {
      setSaveError((s) => ({ ...s, [id]: 'Name is required' }));
      return;
    }
    if (!draft.durationMinutes) {
      setSaveError((s) => ({ ...s, [id]: 'Duration must be a positive number of minutes' }));
      return;
    }

    setSaveState((s) => ({ ...s, [id]: 'saving' }));
    setSaveError((s) => ({ ...s, [id]: '' }));

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok || !data.service) throw new Error(data.error || 'Save failed');
      replaceLocal(data.service);
      setSaveState((s) => ({ ...s, [id]: null }));
      cancelEdit();
    } catch (err) {
      console.error('[services-editor] save failed', err);
      setSaveError((s) => ({ ...s, [id]: err.message || 'Save failed' }));
      setSaveState((s) => ({ ...s, [id]: 'error' }));
    }
  };

  const archive = async (svc) => {
    if (!confirm(`Archive "${svc.name}"? Existing bookings will keep resolving to it, but it'll disappear from the booking page.`)) return;
    setSaveState((s) => ({ ...s, [svc.id]: 'saving' }));
    try {
      const res = await fetch(`/api/admin/services/${encodeURIComponent(svc.id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.service) throw new Error(data.error || 'Archive failed');
      replaceLocal(data.service);
      setSaveState((s) => ({ ...s, [svc.id]: null }));
    } catch (err) {
      console.error('[services-editor] archive failed', err);
      setSaveError((s) => ({ ...s, [svc.id]: err.message || 'Archive failed' }));
      setSaveState((s) => ({ ...s, [svc.id]: 'error' }));
    }
  };

  const restore = async (svc) => {
    setSaveState((s) => ({ ...s, [svc.id]: 'saving' }));
    try {
      const res = await fetch(`/api/admin/services/${encodeURIComponent(svc.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.service) throw new Error(data.error || 'Restore failed');
      replaceLocal(data.service);
      setSaveState((s) => ({ ...s, [svc.id]: null }));
    } catch (err) {
      console.error('[services-editor] restore failed', err);
      setSaveError((s) => ({ ...s, [svc.id]: err.message || 'Restore failed' }));
      setSaveState((s) => ({ ...s, [svc.id]: 'error' }));
    }
  };

  const renderForm = (id) => {
    if (!draft) return null;
    const isSaving = saveState[id] === 'saving';
    return (
      <div className="service-editor-form">
        <div className="form-grid">
          <div className="field">
            <label>Name</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Customized Facial"
              autoFocus
            />
          </div>
          <div className="field">
            <label>Category</label>
            <select
              value={draft.categoryId}
              onChange={(e) => setDraft((d) => ({ ...d, categoryId: e.target.value }))}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Duration (minutes)</label>
            <input
              type="number"
              min="1"
              step="5"
              value={draft.durationMinutes}
              onChange={(e) => setDraft((d) => ({ ...d, durationMinutes: minutesToInt(e.target.value) || 0 }))}
            />
          </div>
          <div className="field">
            <label>Price ($)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={draft.priceCents / 100}
              onChange={(e) => setDraft((d) => ({ ...d, priceCents: dollarsToCents(e.target.value) ?? 0 }))}
            />
          </div>
          <div className="field">
            <label>Deposit override ($, optional)</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Tier default"
              value={draft.depositCents != null ? draft.depositCents / 100 : ''}
              onChange={(e) => {
                const cents = e.target.value === '' ? null : dollarsToCents(e.target.value);
                setDraft((d) => ({ ...d, depositCents: cents }));
              }}
            />
          </div>
          <div className="field">
            <label>Cancellation fee override ($, optional)</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Tier default"
              value={draft.cancellationCents != null ? draft.cancellationCents / 100 : ''}
              onChange={(e) => {
                const cents = e.target.value === '' ? null : dollarsToCents(e.target.value);
                setDraft((d) => ({ ...d, cancellationCents: cents }));
              }}
            />
          </div>
        </div>

        <div className="field">
          <label>Description</label>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="What guests should know about this service…"
          />
        </div>

        {saveError[id] && <p className="payment-error">{saveError[id]}</p>}

        <div className="action-row">
          <button
            type="button"
            className="button button-secondary"
            onClick={cancelEdit}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => save(id)}
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : id === '__new__' ? 'Create service' : 'Save changes'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="services-editor">
      {grouped.map((cat) => (
        <div key={cat.id} className="card services-editor-category">
          <div className="services-editor-category-header">
            <div className="section-header left">
              <span className="eyebrow">{cat.services.length} {cat.services.length === 1 ? 'service' : 'services'}</span>
              <h2>{cat.name}</h2>
            </div>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => startCreate(cat.id)}
            >
              + Add service
            </button>
          </div>

          {creatingCat === cat.id && editingId === '__new__' && (
            <div className="services-editor-row services-editor-row-editing">
              {renderForm('__new__')}
            </div>
          )}

          <ul className="services-editor-list">
            {cat.services.length === 0 ? (
              <li className="muted services-editor-empty">No services in this category yet.</li>
            ) : (
              cat.services.map((svc) => (
                <li
                  key={svc.id}
                  className={`services-editor-row ${svc.isActive ? '' : 'is-archived'} ${editingId === svc.id ? 'services-editor-row-editing' : ''}`}
                >
                  {editingId === svc.id ? (
                    renderForm(svc.id)
                  ) : (
                    <>
                      <div className="services-editor-meta">
                        <strong>{svc.name}</strong>
                        <span className="muted tabular-nums">
                          {svc.duration} · {svc.price}
                        </span>
                        {!svc.isActive && <span className="status-pill warning">Archived</span>}
                      </div>
                      <div className="action-row services-editor-actions">
                        <button type="button" className="button button-secondary" onClick={() => startEdit(svc)}>
                          Edit
                        </button>
                        {svc.isActive ? (
                          <button
                            type="button"
                            className="button button-danger"
                            onClick={() => archive(svc)}
                            disabled={saveState[svc.id] === 'saving'}
                          >
                            Archive
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="button button-primary"
                            onClick={() => restore(svc)}
                            disabled={saveState[svc.id] === 'saving'}
                          >
                            Restore
                          </button>
                        )}
                      </div>
                      {saveError[svc.id] && (
                        <p className="payment-error" style={{ marginTop: 6 }}>
                          {saveError[svc.id]}
                        </p>
                      )}
                    </>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      ))}
    </section>
  );
}
