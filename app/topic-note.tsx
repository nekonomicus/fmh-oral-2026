'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type MouseEvent,
} from 'react';
import type { CaseItem } from './study-data';
import {
  MAX_TOPIC_IMAGES,
  addTopicImages,
  isSupportedImageFile,
  listTopicImages,
  prepareTopicImage,
  removeTopicImage,
  subscribeToTopicImageChanges,
  type TopicImageAttachment,
} from './topic-images';

type TopicNoteButtonProps = {
  item: CaseItem;
  hasNote: boolean;
  onOpen: (item: CaseItem) => void;
  className?: string;
  disabled?: boolean;
};

type TopicNoteDialogProps = {
  item: CaseItem;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  saveError?: boolean;
};

type NoteLink = {
  url: string;
  label: string;
};

function linksFrom(text: string): NoteLink[] {
  const matches = text.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  const unique = new Set(matches.map((match) => match.replace(/[),.;!?]+$/, '')));

  return [...unique].flatMap((url) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return [];
      return [{ url: parsed.href, label: parsed.hostname.replace(/^www\./, '') }];
    } catch {
      return [];
    }
  });
}

function NoteGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.75 3.25h7.7l3.8 3.8v13.7H6.75z" />
      <path d="M14.25 3.5v3.75H18" />
      <path d="M9.5 11.25h6M9.5 14.75h6M9.5 18.25h3.75" />
    </svg>
  );
}

function ImageGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.75" y="4.75" width="16.5" height="14.5" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="m5.75 17 4.2-4.1 2.75 2.4 3.3 3.9" />
    </svg>
  );
}

function imageErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.toUpperCase() : 'IMAGE SAVE FAILED · TRY AGAIN';
}

export function TopicNoteButton({ item, hasNote, onOpen, className = '', disabled = false }: TopicNoteButtonProps) {
  return (
    <button
      type="button"
      className={`topic-note-trigger ${hasNote ? 'has-note' : ''} ${className}`.trim()}
      onClick={() => onOpen(item)}
      aria-label={`${hasNote ? 'Open saved note' : 'Add note'} for ${item.title}`}
      aria-haspopup="dialog"
      disabled={disabled}
      title={hasNote ? 'Open saved note' : 'Add a note'}
    >
      <NoteGlyph />
      {hasNote && <span className="topic-note-dot" aria-hidden="true" />}
    </button>
  );
}

export function TopicNoteDialog({ item, value, onChange, onClose, saveError = false }: TopicNoteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const uploadingRef = useRef(false);
  const [draft, setDraft] = useState(value);
  const [images, setImages] = useState<TopicImageAttachment[]>([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [addingImages, setAddingImages] = useState(0);
  const [imageError, setImageError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const draftRef = useRef(value);
  const lastCommittedRef = useRef<string | null>(value);
  const onChangeRef = useRef(onChange);
  const links = useMemo(() => linksFrom(draft), [draft]);
  const imagePreviews = useMemo(() => images.map((image) => ({
    ...image,
    previewUrl: URL.createObjectURL(image.blob),
  })), [images]);

  const refreshImages = useCallback(async () => {
    const storedImages = await listTopicImages(item.id);
    setImages(storedImages);
    return storedImages;
  }, [item.id]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => () => {
    imagePreviews.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  }, [imagePreviews]);

  useEffect(() => {
    let cancelled = false;
    listTopicImages(item.id)
      .then((storedImages) => {
        if (!cancelled) setImages(storedImages);
      })
      .catch((error: unknown) => {
        if (!cancelled) setImageError(imageErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setImagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  useEffect(() => subscribeToTopicImageChanges((topicId) => {
    if (topicId !== item.id && topicId !== '*') return;
    void refreshImages().catch((error: unknown) => setImageError(imageErrorMessage(error)));
  }), [item.id, refreshImages]);

  const commit = useCallback(() => {
    const next = draftRef.current;
    if (lastCommittedRef.current === next) return;
    lastCommittedRef.current = next;
    onChangeRef.current(next);
  }, []);

  const closeAndSave = useCallback(() => {
    if (addingImages > 0) return;
    commit();
    onClose();
  }, [addingImages, commit, onClose]);

  const downloadNote = () => {
    const heading = `${item.title}\n${item.source} · ${item.miller}\n\n`;
    const blob = new Blob([heading, draft], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const safeTitle = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'topic';
    anchor.href = url;
    anchor.download = `${safeTitle}-notes.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const addFiles = useCallback(async (incoming: File[]) => {
    if (imagesLoading || uploadingRef.current) {
      setImageError('WAIT FOR THE CURRENT IMAGES TO FINISH');
      return;
    }
    const supported = incoming.filter(isSupportedImageFile);
    if (supported.length === 0) {
      setImageError('USE A JPEG, PNG, OR WEBP IMAGE');
      return;
    }

    const availableSlots = Math.max(0, MAX_TOPIC_IMAGES - images.length);
    if (availableSlots === 0) {
      setImageError(`MAXIMUM ${MAX_TOPIC_IMAGES} IMAGES PER TOPIC`);
      return;
    }
    const selected = supported.slice(0, availableSlots);
    setImageError(supported.length > availableSlots ? `ONLY ${availableSlots} MORE IMAGES FIT THIS NOTE` : '');
    uploadingRef.current = true;
    setAddingImages(selected.length);

    try {
      const prepared = [];
      const rejected: string[] = [];
      for (const file of selected) {
        try {
          prepared.push(await prepareTopicImage(file));
        } catch (error) {
          rejected.push(imageErrorMessage(error));
        }
      }
      if (prepared.length > 0) {
        await addTopicImages(item.id, prepared);
        await refreshImages();
      }
      if (rejected.length > 0) setImageError(rejected[0]);
    } catch (error) {
      setImageError(`${imageErrorMessage(error)} · TEXT AND PROGRESS ARE SAFE`);
    } finally {
      uploadingRef.current = false;
      setAddingImages(0);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  }, [images.length, imagesLoading, item.id, refreshImages]);

  const removeImage = async (image: TopicImageAttachment, index: number) => {
    if (uploadingRef.current) return;
    setImageError('');
    try {
      await removeTopicImage(item.id, image.id);
      await refreshImages();
    } catch (error) {
      setImageError(`${imageErrorMessage(error)} · IMAGE ${index + 1} WAS NOT REMOVED`);
    }
  };

  const handleImageInput = (event: ChangeEvent<HTMLInputElement>) => {
    void addFiles(Array.from(event.target.files ?? []));
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.items)
      .filter((entry) => entry.kind === 'file')
      .map((entry) => entry.getAsFile())
      .filter((file): file is File => file !== null && isSupportedImageFile(file));
    if (files.length === 0) return;
    event.preventDefault();
    if (imagesLoading || uploadingRef.current) {
      setImageError('WAIT FOR THE CURRENT IMAGES TO FINISH');
      return;
    }
    void addFiles(files);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (imagesLoading || uploadingRef.current) return;
    const hasFiles = event.dataTransfer.types.includes('Files');
    const hasRemoteUrl = event.dataTransfer.types.includes('text/uri-list');
    if (!hasFiles && !hasRemoteUrl) return;
    event.preventDefault();
    if (!hasFiles) return;
    dragDepthRef.current += 1;
    setDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setDragActive(false);
    if (imagesLoading || uploadingRef.current) {
      setImageError('WAIT FOR THE CURRENT IMAGES TO FINISH');
      return;
    }
    const files = Array.from(event.dataTransfer.files).filter(isSupportedImageFile);
    if (files.length === 0) {
      setImageError('DOWNLOAD REMOTE IMAGES FIRST, THEN DROP THE FILE');
      return;
    }
    void addFiles(files);
  };

  useEffect(() => {
    draftRef.current = draft;
    const saveTimer = window.setTimeout(commit, 250);
    return () => window.clearTimeout(saveTimer);
  }, [commit, draft]);

  // Keep the sheet inside the visible viewport while the on-screen keyboard is open,
  // so the note stays scrollable to its end on phones.
  useEffect(() => {
    const dialog = dialogRef.current;
    const viewport = window.visualViewport;
    if (!dialog || !viewport) return;

    const fit = () => {
      const keyboardOpen = window.innerHeight - viewport.height > 120;
      dialog.style.height = keyboardOpen ? `${Math.round(viewport.height)}px` : '';
      dialog.style.top = keyboardOpen ? `${Math.round(viewport.offsetTop)}px` : '';
    };

    fit();
    viewport.addEventListener('resize', fit);
    viewport.addEventListener('scroll', fit);
    return () => {
      viewport.removeEventListener('resize', fit);
      viewport.removeEventListener('scroll', fit);
      dialog.style.height = '';
      dialog.style.top = '';
    };
  }, []);

  useEffect(() => () => commit(), [commit]);

  useEffect(() => {
    if (saveError) lastCommittedRef.current = null;
  }, [saveError]);

  useEffect(() => {
    if (draftRef.current === lastCommittedRef.current && value !== lastCommittedRef.current) {
      draftRef.current = value;
      lastCommittedRef.current = value;
      setDraft(value);
    }
  }, [value]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const focusFrame = window.requestAnimationFrame(() => textareaRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (dialog.open) dialog.close();
    };
  }, [item.id]);

  const closeFromBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const bounds = dialog.getBoundingClientRect();
    const inside = event.clientX >= bounds.left
      && event.clientX <= bounds.right
      && event.clientY >= bounds.top
      && event.clientY <= bounds.bottom;
    if (!inside) closeAndSave();
  };

  const imageCountLabel = `${images.length} ${images.length === 1 ? 'IMAGE' : 'IMAGES'}`;

  return (
    <dialog
      ref={dialogRef}
      className="topic-note-dialog"
      aria-labelledby={`topic-note-title-${item.id}`}
      onCancel={(event) => {
        event.preventDefault();
        closeAndSave();
      }}
      onMouseDown={closeFromBackdrop}
    >
      <div className="topic-note-sheet">
        <header className="topic-note-head">
          <div>
            <span className="topic-note-kicker">TOPIC NOTE · {item.source}</span>
            <h2 id={`topic-note-title-${item.id}`}>{item.title}</h2>
            <span className="topic-note-source">{item.miller}</span>
          </div>
          <button
            type="button"
            className="topic-note-close"
            onClick={closeAndSave}
            aria-label={addingImages > 0 ? 'Wait for images to finish saving' : 'Close notes'}
            disabled={addingImages > 0}
          >
            <span aria-hidden="true">{addingImages > 0 ? 'WAIT' : 'DONE'}</span>
          </button>
        </header>

        <div className="topic-note-toolbar">
          <input
            ref={imageInputRef}
            className="file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleImageInput}
          />
          <button
            type="button"
            className="topic-note-add-image"
            onClick={() => imageInputRef.current?.click()}
            disabled={imagesLoading || addingImages > 0 || images.length >= MAX_TOPIC_IMAGES}
          >
            <ImageGlyph />
            <span>{addingImages > 0 ? `ADDING ${addingImages}` : 'ADD IMAGE'}</span>
          </button>
          <span>PASTE OR DROP · FITS TO NOTE</span>
        </div>

        <div
          className={`topic-note-content ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDragEnter}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes('Files') || event.dataTransfer.types.includes('text/uri-list')) {
              event.preventDefault();
            }
          }}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {dragActive && <div className="topic-note-drop" aria-hidden="true">DROP IMAGES</div>}
          {/* The wrapper's ::after mirrors the text so the editor grows without a JS remeasure,
              which used to collapse the scroll pane and reset its scroll position on every keystroke. */}
          <div className="topic-note-grow" data-replica={draft}>
            <textarea
              ref={textareaRef}
              className="topic-note-editor"
              value={draft}
              onChange={(event) => {
                draftRef.current = event.target.value;
                setDraft(event.target.value);
              }}
              onPaste={handlePaste}
              onBlur={commit}
              aria-label={`Notes for ${item.title}`}
              spellCheck
            />
          </div>

          {imagesLoading ? (
            <div className="topic-note-image-loading" aria-live="polite">LOADING IMAGES…</div>
          ) : imagePreviews.length > 0 ? (
            <div className="topic-note-images" aria-label={`Images for ${item.title}`}>
              {imagePreviews.map((image, index) => (
                <figure key={image.id} className="topic-note-image">
                  {/* Object URLs from local IndexedDB cannot use the hosted image optimizer. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.previewUrl}
                    alt={`${image.name || `Image ${index + 1}`} for ${item.title}`}
                    width={image.width}
                    height={image.height}
                  />
                  <button
                    type="button"
                    className="topic-note-image-remove"
                    onClick={() => void removeImage(image, index)}
                    disabled={addingImages > 0}
                    aria-label={`Remove image ${index + 1} from ${item.title}`}
                    title="Remove image"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                  <figcaption>{String(index + 1).padStart(2, '0')} · {image.name}</figcaption>
                </figure>
              ))}
            </div>
          ) : null}
        </div>

        <div className="topic-note-foot">
          <div className={`topic-note-save ${saveError || imageError ? 'error' : ''}`}>
            <span role={saveError || imageError ? 'alert' : 'status'} aria-live="polite">
              {saveError ? (
                <button type="button" onClick={downloadNote}>TEXT SAVE FAILED · DOWNLOAD NOTE</button>
              ) : imageError ? (
                imageError
              ) : addingImages > 0 ? (
                `ADDING ${addingImages} ${addingImages === 1 ? 'IMAGE' : 'IMAGES'}…`
              ) : (
                'AUTO-SAVED ON THIS DEVICE'
              )}
            </span>
            <span aria-label={`${draft.length.toLocaleString()} characters and ${imageCountLabel.toLowerCase()}`}>
              {draft.length.toLocaleString()} CHAR · {imageCountLabel}
            </span>
          </div>
          {links.length > 0 && (
            <div className="topic-note-links" aria-label="Links in this note">
              <span className="topic-note-links-label">LINKS</span>
              <div>
                {links.map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                    {link.label}<span aria-hidden="true"> ↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
