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
import {
  ATTACHMENT_ACCEPT,
  attachmentKind,
  formatBytes,
  isPreviewableImage,
  isSupportedAttachment,
  prepareAttachment,
} from './attachments';
import {
  PLAYERS,
  deleteSharedFile,
  listSharedFiles,
  partnerOf,
  playerLabel,
  sharedFileUrl,
  uploadSharedFile,
  type SharedFile,
  type SyncConfig,
  type TileState,
} from './sync';

type TopicNoteButtonProps = {
  item: CaseItem;
  hasNote: boolean;
  onOpen: (item: CaseItem) => void;
  className?: string;
  disabled?: boolean;
  /** Who attached shared files: left half Michael, right half Sam. */
  fileState?: TileState;
};

type TopicNoteDialogProps = {
  item: CaseItem;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  saveError?: boolean;
  savedLabel?: string;
  /** Present when connected: attachments are shared between both players. */
  sync?: SyncConfig | null;
  onFilesChanged?: () => void;
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

function ClipGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.5 7.5v8.25a4.5 4.5 0 0 1-9 0V6.25a3 3 0 0 1 6 0v9a1.5 1.5 0 0 1-3 0V8" />
    </svg>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.toUpperCase() : 'SAVE FAILED · TRY AGAIN';
}

export function TopicNoteButton({ item, hasNote, onOpen, className = '', disabled = false, fileState = 'none' }: TopicNoteButtonProps) {
  return (
    <button
      type="button"
      className={`topic-note-trigger ${hasNote ? 'has-note' : ''} ${className}`.trim()}
      onClick={() => onOpen(item)}
      aria-label={`${hasNote ? 'Open saved note' : 'Add note'} for ${item.title}${fileState !== 'none' ? '. Has attachments' : ''}`}
      aria-haspopup="dialog"
      disabled={disabled}
      title={hasNote ? 'Open saved note' : 'Add a note'}
    >
      <NoteGlyph />
      {hasNote && <span className="topic-note-dot" aria-hidden="true" />}
      {fileState !== 'none' && <span className={`attach-mark ${fileState}`} aria-hidden="true" />}
    </button>
  );
}

export function TopicNoteDialog({
  item, value, onChange, onClose, saveError = false, savedLabel = 'AUTO-SAVED ON THIS DEVICE', sync = null, onFilesChanged,
}: TopicNoteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const uploadingRef = useRef(false);
  const [draft, setDraft] = useState(value);
  const [images, setImages] = useState<TopicImageAttachment[]>([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [shared, setShared] = useState<SharedFile[]>([]);
  const [sharedLoading, setSharedLoading] = useState(Boolean(sync));
  const [adding, setAdding] = useState(0);
  const [fileError, setFileError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const draftRef = useRef(value);
  const lastCommittedRef = useRef<string | null>(value);
  const onChangeRef = useRef(onChange);
  const onFilesChangedRef = useRef(onFilesChanged);
  const links = useMemo(() => linksFrom(draft), [draft]);
  const imagePreviews = useMemo(() => images.map((image) => ({
    ...image,
    previewUrl: URL.createObjectURL(image.blob),
  })), [images]);
  const sharedMode = Boolean(sync);
  const partnerLabel = sync ? playerLabel(partnerOf(sync.player)) : '';

  const refreshImages = useCallback(async () => {
    const storedImages = await listTopicImages(item.id);
    setImages(storedImages);
    return storedImages;
  }, [item.id]);

  useEffect(() => {
    onChangeRef.current = onChange;
    onFilesChangedRef.current = onFilesChanged;
  }, [onChange, onFilesChanged]);

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
        if (!cancelled) setFileError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setImagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  useEffect(() => {
    if (!sync) return;
    let cancelled = false;
    listSharedFiles(sync, item.id)
      .then((files) => {
        if (!cancelled) setShared(files);
      })
      .catch(() => {
        if (!cancelled) setFileError('SHARED FILES COULD NOT BE LOADED');
      })
      .finally(() => {
        if (!cancelled) setSharedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, sync]);

  useEffect(() => subscribeToTopicImageChanges((topicId) => {
    if (topicId !== item.id && topicId !== '*') return;
    void refreshImages().catch((error: unknown) => setFileError(errorMessage(error)));
  }), [item.id, refreshImages]);

  const commit = useCallback(() => {
    const next = draftRef.current;
    if (lastCommittedRef.current === next) return;
    lastCommittedRef.current = next;
    onChangeRef.current(next);
  }, []);

  const closeAndSave = useCallback(() => {
    if (adding > 0) return;
    commit();
    onClose();
  }, [adding, commit, onClose]);

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

  const busyGuard = () => {
    if (imagesLoading || sharedLoading || uploadingRef.current) {
      setFileError('WAIT FOR THE CURRENT FILES TO FINISH');
      return true;
    }
    return false;
  };

  const addSharedFiles = useCallback(async (incoming: File[]) => {
    if (!sync) return;
    const supported = incoming.filter(isSupportedAttachment);
    if (supported.length === 0) {
      setFileError('USE AN IMAGE, PDF, OR PPTX');
      return;
    }
    uploadingRef.current = true;
    setAdding(supported.length);
    setFileError('');
    const rejected: string[] = [];
    try {
      for (const file of supported) {
        try {
          const prepared = await prepareAttachment(file);
          const uploaded = await uploadSharedFile(sync, item.id, prepared.name, prepared.type, prepared.blob);
          setShared((current) => [...current, uploaded]);
        } catch (error) {
          rejected.push(errorMessage(error));
        }
        setAdding((current) => Math.max(0, current - 1));
      }
      if (rejected.length > 0) setFileError(rejected[0]);
    } finally {
      uploadingRef.current = false;
      setAdding(0);
      onFilesChangedRef.current?.();
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [item.id, sync]);

  const addLocalImages = useCallback(async (incoming: File[]) => {
    const supported = incoming.filter(isSupportedImageFile);
    if (supported.length === 0) {
      setFileError('USE A JPEG, PNG, OR WEBP IMAGE');
      return;
    }
    const availableSlots = Math.max(0, MAX_TOPIC_IMAGES - images.length);
    if (availableSlots === 0) {
      setFileError(`MAXIMUM ${MAX_TOPIC_IMAGES} IMAGES PER TOPIC`);
      return;
    }
    const selected = supported.slice(0, availableSlots);
    setFileError(supported.length > availableSlots ? `ONLY ${availableSlots} MORE IMAGES FIT THIS NOTE` : '');
    uploadingRef.current = true;
    setAdding(selected.length);
    try {
      const prepared = [];
      const rejected: string[] = [];
      for (const file of selected) {
        try {
          prepared.push(await prepareTopicImage(file));
        } catch (error) {
          rejected.push(errorMessage(error));
        }
      }
      if (prepared.length > 0) {
        await addTopicImages(item.id, prepared);
        await refreshImages();
      }
      if (rejected.length > 0) setFileError(rejected[0]);
    } catch (error) {
      setFileError(`${errorMessage(error)} · TEXT AND PROGRESS ARE SAFE`);
    } finally {
      uploadingRef.current = false;
      setAdding(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [images.length, item.id, refreshImages]);

  const addFiles = sharedMode ? addSharedFiles : addLocalImages;

  const removeShared = async (file: SharedFile) => {
    if (!sync || uploadingRef.current) return;
    setFileError('');
    try {
      await deleteSharedFile(sync, file.id);
      setShared((current) => current.filter((entry) => entry.id !== file.id));
      onFilesChangedRef.current?.();
    } catch (error) {
      setFileError(`${errorMessage(error)} · ${file.name.toUpperCase()} WAS NOT REMOVED`);
    }
  };

  const removeLocalImage = async (image: TopicImageAttachment, index: number) => {
    if (uploadingRef.current) return;
    setFileError('');
    try {
      await removeTopicImage(item.id, image.id);
      await refreshImages();
    } catch (error) {
      setFileError(`${errorMessage(error)} · IMAGE ${index + 1} WAS NOT REMOVED`);
    }
  };

  /** Moves a device-only image into the shared store. */
  const shareLocalImage = async (image: TopicImageAttachment) => {
    if (!sync || uploadingRef.current) return;
    uploadingRef.current = true;
    setAdding(1);
    setFileError('');
    try {
      const uploaded = await uploadSharedFile(sync, item.id, image.name || 'image.jpg', image.mimeType, image.blob);
      setShared((current) => [...current, uploaded]);
      await removeTopicImage(item.id, image.id);
      await refreshImages();
      onFilesChangedRef.current?.();
    } catch (error) {
      setFileError(`${errorMessage(error)} · IMAGE STAYS ON THIS DEVICE`);
    } finally {
      uploadingRef.current = false;
      setAdding(0);
    }
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    void addFiles(Array.from(event.target.files ?? []));
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const accept = sharedMode ? isSupportedAttachment : isSupportedImageFile;
    const files = Array.from(event.clipboardData.items)
      .filter((entry) => entry.kind === 'file')
      .map((entry) => entry.getAsFile())
      .filter((file): file is File => file !== null && accept(file));
    if (files.length === 0) return;
    event.preventDefault();
    if (busyGuard()) return;
    void addFiles(files);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (imagesLoading || sharedLoading || uploadingRef.current) return;
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
    if (busyGuard()) return;
    const accept = sharedMode ? isSupportedAttachment : isSupportedImageFile;
    const files = Array.from(event.dataTransfer.files).filter(accept);
    if (files.length === 0) {
      setFileError(sharedMode ? 'USE AN IMAGE, PDF, OR PPTX · DOWNLOAD REMOTE FILES FIRST' : 'DOWNLOAD REMOTE IMAGES FIRST, THEN DROP THE FILE');
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

  const fileCount = sharedMode ? shared.length : images.length;
  const countLabel = `${fileCount} ${fileCount === 1 ? 'FILE' : 'FILES'}`;
  const loading = sharedMode ? sharedLoading : imagesLoading;
  const addDisabled = loading || adding > 0 || (!sharedMode && images.length >= MAX_TOPIC_IMAGES);
  const ownerTag = (player: SharedFile['player']) => PLAYERS.find((option) => option.id === player)?.initial ?? '?';

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
            aria-label={adding > 0 ? 'Wait for files to finish saving' : 'Close notes'}
            disabled={adding > 0}
          >
            <span aria-hidden="true">{adding > 0 ? 'WAIT' : 'DONE'}</span>
          </button>
        </header>

        <div className="topic-note-toolbar">
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            accept={sharedMode ? ATTACHMENT_ACCEPT : 'image/jpeg,image/png,image/webp'}
            multiple
            onChange={handleFileInput}
          />
          <button
            type="button"
            className="topic-note-add-image"
            onClick={() => fileInputRef.current?.click()}
            disabled={addDisabled}
          >
            {sharedMode ? <ClipGlyph /> : <ImageGlyph />}
            <span>{adding > 0 ? `ADDING ${adding}` : sharedMode ? 'ADD FILE' : 'ADD IMAGE'}</span>
          </button>
          <span>{sharedMode ? `IMAGE · PDF · PPTX · SHARED WITH ${partnerLabel}` : 'PASTE OR DROP · ON THIS DEVICE'}</span>
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
          {dragActive && <div className="topic-note-drop" aria-hidden="true">{sharedMode ? 'DROP FILES' : 'DROP IMAGES'}</div>}
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

          {sharedMode && (sharedLoading ? (
            <div className="topic-note-image-loading" aria-live="polite">LOADING SHARED FILES…</div>
          ) : shared.length > 0 ? (
            <div className="topic-note-images" aria-label={`Shared files for ${item.title}`}>
              {shared.map((file, index) => {
                const kind = attachmentKind(file.type);
                const own = sync?.player === file.player;
                const caption = `${String(index + 1).padStart(2, '0')} · ${file.name} · ${formatBytes(file.size)}`;
                return (
                  <figure key={file.id} className={`topic-note-image ${kind === 'image' && isPreviewableImage(file.type) ? '' : 'topic-note-file'}`}>
                    {kind === 'image' && isPreviewableImage(file.type) ? (
                      <a href={sharedFileUrl(file.id)} target="_blank" rel="noreferrer">
                        {/* Served through our own API with a short-lived redirect; no image optimizer. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sharedFileUrl(file.id)} alt={`${file.name} for ${item.title}`} loading="lazy" />
                      </a>
                    ) : (
                      <a className="topic-note-file-card" href={sharedFileUrl(file.id)} target="_blank" rel="noreferrer">
                        <span className="topic-note-file-kind">{kind === 'file' ? 'FILE' : kind.toUpperCase()}</span>
                        <span className="topic-note-file-name">{file.name}</span>
                        <span className="topic-note-file-meta">{formatBytes(file.size)} · OPEN ↗</span>
                      </a>
                    )}
                    <span className={`topic-note-owner ${file.player}`} title={`Added by ${playerLabel(file.player)}`}>{ownerTag(file.player)}</span>
                    {own && (
                      <button
                        type="button"
                        className="topic-note-image-remove"
                        onClick={() => void removeShared(file)}
                        disabled={adding > 0}
                        aria-label={`Remove ${file.name} from ${item.title}`}
                        title="Remove file"
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    )}
                    <figcaption>{caption}</figcaption>
                  </figure>
                );
              })}
            </div>
          ) : null)}

          {imagesLoading ? (
            <div className="topic-note-image-loading" aria-live="polite">LOADING IMAGES…</div>
          ) : imagePreviews.length > 0 ? (
            <div className="topic-note-images" aria-label={`Images on this device for ${item.title}`}>
              {sharedMode && <div className="topic-note-local-label">ON THIS DEVICE ONLY · SHARE TO LET {partnerLabel} SEE THEM</div>}
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
                  {sharedMode && (
                    <button
                      type="button"
                      className="topic-note-image-share"
                      onClick={() => void shareLocalImage(image)}
                      disabled={adding > 0}
                      aria-label={`Share image ${index + 1} with ${partnerLabel}`}
                    >
                      SHARE
                    </button>
                  )}
                  <button
                    type="button"
                    className="topic-note-image-remove"
                    onClick={() => void removeLocalImage(image, index)}
                    disabled={adding > 0}
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
          <div className={`topic-note-save ${saveError || fileError ? 'error' : ''}`}>
            <span role={saveError || fileError ? 'alert' : 'status'} aria-live="polite">
              {saveError ? (
                <button type="button" onClick={downloadNote}>TEXT SAVE FAILED · DOWNLOAD NOTE</button>
              ) : fileError ? (
                fileError
              ) : adding > 0 ? (
                `${sharedMode ? 'UPLOADING' : 'ADDING'} ${adding} ${adding === 1 ? 'FILE' : 'FILES'}…`
              ) : (
                savedLabel
              )}
            </span>
            <span aria-label={`${draft.length.toLocaleString()} characters and ${countLabel.toLowerCase()}`}>
              {draft.length.toLocaleString()} CHAR · {countLabel}
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
