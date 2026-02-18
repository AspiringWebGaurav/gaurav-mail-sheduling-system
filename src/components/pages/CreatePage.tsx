'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { createEvent, deleteEvent } from '@/services/eventService';
import { addParticipant, createScheduledReminder } from '@/services/participantServiceFixed';
import { createTokenInvite } from '@/services/invitationService';
import { useAppStore } from '@/stores/appStore';
import { getTemplates } from '@/services/templateService';
import { getThemes } from '@/services/themeService';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarPlus, ArrowLeft, ArrowRight, Palette, Clock, MapPin, AlignLeft, User, Users, X as XIcon, Mail, AlertTriangle, Zap, Send } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import type { EmailTemplate, EmailTheme } from '@/types';
import styles from './CreatePage.module.css';
import dynamic from 'next/dynamic';

const TemplateGallery = dynamic(() => import('@/components/email/TemplateGallery').then(mod => mod.TemplateGallery), {
    loading: () => null,
    ssr: false // Client-side only modal
});

const DEFAULT_TEMPLATE_ID = 'sys_template_prof_reminder';
const DEFAULT_THEME_ID = 'sys_theme_modern_blue';

/* ── Type definitions for the modular create flow ── */
type CreateType = 'event' | 'send_mail' | 'important_mail';

interface CreateTypeConfig {
    id: CreateType;
    icon: React.ReactNode;
    label: string;
    description: string;
    color: string;
}

const CREATE_TYPES: CreateTypeConfig[] = [
    {
        id: 'event',
        icon: <CalendarPlus size={24} />,
        label: 'Event',
        description: 'Schedule an event with reminders',
        color: '#6c5ce7',
    },
    {
        id: 'send_mail',
        icon: <Mail size={24} />,
        label: 'Send Mail',
        description: 'Quick email with scheduling',
        color: '#00d2ff',
    },
    {
        id: 'important_mail',
        icon: <Zap size={24} />,
        label: 'Important Mail',
        description: 'Priority email with urgent templates',
        color: '#ff4757',
    },
];

/* ── Scheduling mode types ── */
type ScheduleMode = 'before_event' | 'exact_time';

export default function CreatePage() {
    const { user, firebaseUser } = useAuth();
    const router = useRouter();
    const showToast = useAppStore((s) => s.showToast);

    // Type Selection
    const [selectedType, setSelectedType] = useState<CreateType | null>(null);

    // Steps: 1 = Details, 2 = Communication & Design
    const [step, setStep] = useState(1);

    // Form State — Event
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('');

    // Invite emails (chip-based, for event creation)
    const [inviteEmails, setInviteEmails] = useState<string[]>([]);
    const [inviteInput, setInviteInput] = useState('');

    // Form State — Mail
    const [subject, setSubject] = useState('');
    const [messageBody, setMessageBody] = useState('');

    // Comm State
    const [recipientEmail, setRecipientEmail] = useState('');

    // Scheduling State (refactored — no hard 10-min restriction)
    const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('before_event');
    const [reminderTiming, setReminderTiming] = useState(10);
    const [exactDate, setExactDate] = useState('');
    const [exactTime, setExactTime] = useState('');
    const [pastTimeWarning, setPastTimeWarning] = useState(false);

    // Design State
    const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE_ID);
    const [selectedThemeId, setSelectedThemeId] = useState(DEFAULT_THEME_ID);
    const [customMessage, setCustomMessage] = useState('');
    const [showGallery, setShowGallery] = useState(false);

    // Data for lookup
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [themes, setThemes] = useState<EmailTheme[]>([]);
    const [saving, setSaving] = useState(false);
    const submitLockRef = useRef(false); // Hard lock — survives React re-renders

    // Pre-fill email
    useEffect(() => {
        if (user && !recipientEmail) setRecipientEmail(user.email || '');
    }, [user, recipientEmail]);

    // Load templates/themes for names
    useEffect(() => {
        if (!user) return;
        Promise.all([getTemplates(user.uid), getThemes(user.uid)]).then(([tpls, thms]) => {
            setTemplates(tpls);
            setThemes(thms);
        });
    }, [user]);

    // Auto-select urgent templates for important mail
    useEffect(() => {
        if (selectedType === 'important_mail') {
            const urgentTemplate = templates.find(t => t.id === 'sys_template_urgent_alert');
            if (urgentTemplate) setSelectedTemplateId(urgentTemplate.id);
        } else {
            setSelectedTemplateId(DEFAULT_TEMPLATE_ID);
        }
    }, [selectedType, templates]);

    // Past-time validation for exact scheduling
    useEffect(() => {
        if (scheduleMode !== 'exact_time' || !exactDate || !exactTime) {
            setPastTimeWarning(false);
            return;
        }
        const scheduled = new Date(`${exactDate}T${exactTime}`);
        setPastTimeWarning(scheduled < new Date());
    }, [scheduleMode, exactDate, exactTime]);

    // Derived Selection Display
    const selectedTemplate = useMemo(() => templates.find(t => t.id === selectedTemplateId), [templates, selectedTemplateId]);
    const selectedTheme = useMemo(() => themes.find(t => t.id === selectedThemeId), [themes, selectedThemeId]);

    const isMailType = selectedType === 'send_mail' || selectedType === 'important_mail';

    const handleNext = () => {
        if (isMailType) {
            if (!subject) {
                showToast('Please enter a subject.', 'error');
                return;
            }
        } else {
            if (!title || !startDate || !startTime || !endDate || !endTime) {
                showToast('Please fill in all required fields.', 'error');
                return;
            }
            const start = new Date(`${startDate}T${startTime}`);
            const end = new Date(`${endDate}T${endTime}`);
            if (end <= start) {
                showToast('End time must be after start time', 'error');
                return;
            }
        }
        setStep(2);
    };

    const computeScheduledTime = useCallback((): Date => {
        if (isMailType) {
            if (scheduleMode === 'exact_time' && exactDate && exactTime) {
                return new Date(`${exactDate}T${exactTime}`);
            }
            // For mail types with "before_event" mode, send immediately
            return new Date(Date.now() + reminderTiming * 60000);
        }
        // Event type
        const start = new Date(`${startDate}T${startTime}`);
        if (scheduleMode === 'exact_time' && exactDate && exactTime) {
            return new Date(`${exactDate}T${exactTime}`);
        }
        return new Date(start.getTime() - reminderTiming * 60000);
    }, [isMailType, scheduleMode, exactDate, exactTime, startDate, startTime, reminderTiming]);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!user || saving) return;

        // ── Hard submit lock — survives React re-renders ──
        if (submitLockRef.current) return;
        submitLockRef.current = true;

        // ── Email validation ──
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipientEmail)) {
            showToast('Please enter a valid email address', 'error');
            submitLockRef.current = false;
            return;
        }

        setSaving(true);
        let createdEventId: string | null = null;
        try {
            const scheduledTime = computeScheduledTime();

            if (isMailType) {
                // Mail types: create a minimal event + scheduled reminder
                const eventTitle = subject || 'Mail';
                const now = new Date();
                const eventId = await createEvent({
                    title: eventTitle,
                    description: messageBody || '',
                    location: '',
                    startTime: scheduledTime > now ? scheduledTime : now,
                    endTime: new Date((scheduledTime > now ? scheduledTime : now).getTime() + 60000),
                    categoryId: '',
                    createdBy: user.uid,
                });
                createdEventId = eventId;

                const participantId = await addParticipant(eventId, {
                    userId: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    role: 'owner',
                });

                await createScheduledReminder({
                    eventId,
                    eventTitle: eventTitle,
                    participantId,
                    userId: user.uid,
                    userEmail: user.email || '',
                    userName: user.displayName || 'User',
                    email: recipientEmail,
                    scheduledTime,
                    templateId: selectedTemplateId,
                    themeId: selectedThemeId,
                    customMessage: customMessage || messageBody || undefined,
                });

                showToast('Mail scheduled successfully', 'success');
                router.push(`/events/${eventId}`);
            } else {
                // Event type: original flow
                const start = new Date(`${startDate}T${startTime}`);
                const end = new Date(`${endDate}T${endTime}`);

                const eventId = await createEvent({
                    title,
                    description,
                    location,
                    startTime: start,
                    endTime: end,
                    categoryId: '',
                    createdBy: user.uid,
                });
                createdEventId = eventId;

                const participantId = await addParticipant(eventId, {
                    userId: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    role: 'owner',
                });

                await createScheduledReminder({
                    eventId,
                    eventTitle: title,
                    participantId,
                    userId: user.uid,
                    userEmail: user.email || '',
                    userName: user.displayName || 'User',
                    email: recipientEmail,
                    scheduledTime,
                    templateId: selectedTemplateId,
                    themeId: selectedThemeId,
                    customMessage: customMessage || undefined,
                });

                showToast('Event created successfully', 'success');

                // ── Fire-and-forget: Send invites for each added email ──
                if (inviteEmails.length > 0 && firebaseUser) {
                    (async () => {
                        try {
                            const authToken = await firebaseUser.getIdToken();
                            const start = new Date(`${startDate}T${startTime}`);
                            const eventTimeStr = format(start, 'EEE, MMM d \u00b7 h:mm a');
                            let sentCount = 0;
                            for (const email of inviteEmails) {
                                try {
                                    await createTokenInvite({
                                        eventId,
                                        eventTitle: title,
                                        inviteeEmail: email,
                                        role: 'viewer',
                                        inviterName: user.displayName,
                                        inviterEmail: user.email,
                                        eventTime: eventTimeStr,
                                        eventLocation: location || undefined,
                                        authToken,
                                    });
                                    sentCount++;
                                } catch {
                                    // Individual invite failure — continue with others
                                }
                            }
                            if (sentCount > 0) {
                                showToast(`\u2713 ${sentCount} invitation${sentCount > 1 ? 's' : ''} sent`, 'success');
                            }
                            if (sentCount < inviteEmails.length) {
                                showToast(`${inviteEmails.length - sentCount} invite(s) failed — retry from event page`, 'error');
                            }
                        } catch {
                            // Auth failure — silently degrade
                        }
                    })();
                }

                router.push(`/events/${eventId}`);
            }
        } catch (err) {
            console.error(err);
            showToast(`Failed to create ${isMailType ? 'mail' : 'event'}`, 'error');

            // ── Partial failure rollback — delete orphan event ──
            if (createdEventId) {
                try { await deleteEvent(createdEventId); } catch { /* best effort cleanup */ }
            }
        } finally {
            setSaving(false);
            submitLockRef.current = false;
        }
    };

    /* ── Step 0: Type Selector ── */
    if (!selectedType) {
        return (
            <div className="page-container">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={styles.topBar}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Link href="/" className={styles.backBtn}><ArrowLeft size={20} /></Link>
                        <h1 className="page-title">Create New</h1>
                    </div>
                </motion.div>

                <motion.p
                    className={styles.typeSubtitle}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    What would you like to create?
                </motion.p>

                <div className={styles.typeGrid}>
                    {CREATE_TYPES.map((type, i) => (
                        <motion.button
                            key={type.id}
                            className={styles.typeCard}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + i * 0.08 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedType(type.id)}
                        >
                            <div className={styles.typeCardIcon} style={{ background: `${type.color}18`, color: type.color }}>
                                {type.icon}
                            </div>
                            <div className={styles.typeCardContent}>
                                <span className={styles.typeCardLabel}>{type.label}</span>
                                <span className={styles.typeCardDesc}>{type.description}</span>
                            </div>
                            <ArrowRight size={16} className={styles.typeCardChevron} />
                        </motion.button>
                    ))}
                </div>
            </div>
        );
    }

    /* ── Step 1 & 2: Form ── */
    const currentTypeConfig = CREATE_TYPES.find(t => t.id === selectedType)!;
    const totalSteps = 2;

    return (
        <div className="page-container">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={styles.topBar}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                        className={styles.backBtn}
                        onClick={() => step === 1 ? setSelectedType(null) : setStep(1)}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="page-title" style={{ fontSize: 'var(--text-lg)' }}>{currentTypeConfig.label}</h1>
                    </div>
                </div>
                {/* Stepper Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {Array.from({ length: totalSteps }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {i > 0 && <div style={{ width: 20, height: 2, background: 'var(--border-color)' }} />}
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: step >= i + 1 ? 'var(--primary-color)' : 'var(--border-color)' }} />
                        </div>
                    ))}
                </div>
            </motion.div>

            <AnimatePresence mode='wait'>
                {step === 1 ? (
                    <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className={styles.form}
                    >
                        {/* ── Event Details ── */}
                        {!isMailType && (
                            <>
                                <h2 className={styles.sectionTitle}><AlignLeft size={18} /> Event Details</h2>

                                <div className={styles.field}>
                                    <label className="label">Event Title</label>
                                    <input className="input-field" placeholder="e.g. Q4 Strategy Meeting" value={title} onChange={e => setTitle(e.target.value)} autoFocus required />
                                </div>

                                <div className={styles.row}>
                                    <div className={styles.field}>
                                        <label className="label"><Clock size={14} /> Start</label>
                                        <div className={styles.inputGroup}>
                                            <input className="input-field" type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value); }} onClick={(e) => e.currentTarget.showPicker()} required />
                                            <input className="input-field" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} onClick={(e) => e.currentTarget.showPicker()} required />
                                        </div>
                                    </div>
                                    <div className={styles.field}>
                                        <label className="label">End</label>
                                        <div className={styles.inputGroup}>
                                            <input className="input-field" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} onClick={(e) => e.currentTarget.showPicker()} required />
                                            <input className="input-field" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} onClick={(e) => e.currentTarget.showPicker()} required />
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.field}>
                                    <label className="label"><MapPin size={14} /> Location (Optional)</label>
                                    <input className="input-field" placeholder="e.g. Conference Room A" value={location} onChange={e => setLocation(e.target.value)} />
                                </div>

                                <div className={styles.field}>
                                    <label className="label">Description (Optional)</label>
                                    <textarea className={`input-field ${styles.textarea}`} placeholder="Add agenda or details..." value={description} onChange={e => setDescription(e.target.value)} rows={3} />
                                </div>

                                {/* ── Invite Participants (Optional) ── */}
                                <div className={styles.field}>
                                    <label className="label"><Users size={14} /> Invite Participants (Optional)</label>
                                    <div className={styles.chipList}>
                                        {inviteEmails.map((email, i) => (
                                            <span key={i} className={styles.chip}>
                                                {email}
                                                <button type="button" className={styles.chipRemove} onClick={() => setInviteEmails(prev => prev.filter((_, idx) => idx !== i))}>
                                                    <XIcon size={12} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <input
                                            className="input-field"
                                            type="email"
                                            placeholder="Enter email & press Enter"
                                            value={inviteInput}
                                            onChange={e => setInviteInput(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const email = inviteInput.trim();
                                                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                                    if (email && emailRegex.test(email) && !inviteEmails.includes(email)) {
                                                        setInviteEmails(prev => [...prev, email]);
                                                        setInviteInput('');
                                                    } else if (email && !emailRegex.test(email)) {
                                                        showToast('Invalid email format', 'error');
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                    <p className={styles.hint}>Invitations will be sent after event creation</p>
                                </div>
                            </>
                        )}

                        {/* ── Mail Details ── */}
                        {isMailType && (
                            <>
                                <h2 className={styles.sectionTitle}>
                                    {selectedType === 'important_mail' ? <><Zap size={18} /> Priority Mail</> : <><Send size={18} /> Compose Mail</>}
                                </h2>

                                <div className={styles.field}>
                                    <label className="label">Subject</label>
                                    <input className="input-field" placeholder="e.g. Monthly Report Reminder" value={subject} onChange={e => setSubject(e.target.value)} autoFocus required />
                                </div>

                                <div className={styles.field}>
                                    <label className="label">Message (Optional)</label>
                                    <textarea className={`input-field ${styles.textarea}`} placeholder="Write your message..." value={messageBody} onChange={e => setMessageBody(e.target.value)} rows={4} />
                                </div>
                            </>
                        )}

                        <div className={styles.actions}>
                            <button className="btn-primary" onClick={handleNext} style={{ width: '100%' }}>
                                Next: Schedule & Design <ArrowRight size={16} />
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className={styles.form}
                    >
                        <h2 className={styles.sectionTitle}><User size={18} /> Recipients & Schedule</h2>

                        <div className={styles.field}>
                            <label className="label">Sending To</label>
                            <input className="input-field" type="email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} required />
                            <span className={styles.hint}>Currently limited to single recipient</span>
                        </div>

                        {/* ── Scheduling Section ── */}
                        <div className={styles.scheduleSection}>
                            <label className="label"><Clock size={14} /> Schedule</label>
                            <div className={styles.scheduleToggle}>
                                <button
                                    className={`${styles.scheduleBtn} ${scheduleMode === 'before_event' ? styles.scheduleBtnActive : ''}`}
                                    onClick={() => setScheduleMode('before_event')}
                                >
                                    {isMailType ? 'Delay' : 'Before Event'}
                                </button>
                                <button
                                    className={`${styles.scheduleBtn} ${scheduleMode === 'exact_time' ? styles.scheduleBtnActive : ''}`}
                                    onClick={() => setScheduleMode('exact_time')}
                                >
                                    Exact Time
                                </button>
                            </div>

                            {scheduleMode === 'before_event' ? (
                                <select className="input-field" value={reminderTiming} onChange={e => setReminderTiming(Number(e.target.value))}>
                                    <option value={0}>Immediately / At event start</option>
                                    <option value={5}>5 minutes {isMailType ? 'delay' : 'before start'}</option>
                                    <option value={10}>10 minutes {isMailType ? 'delay' : 'before start'}</option>
                                    <option value={15}>15 minutes {isMailType ? 'delay' : 'before start'}</option>
                                    <option value={30}>30 minutes {isMailType ? 'delay' : 'before start'}</option>
                                    <option value={60}>1 hour {isMailType ? 'delay' : 'before start'}</option>
                                    <option value={1440}>1 day {isMailType ? 'delay' : 'before start'}</option>
                                </select>
                            ) : (
                                <div className={styles.inputGroup}>
                                    <input className="input-field" type="date" value={exactDate} onChange={e => setExactDate(e.target.value)} onClick={(e) => e.currentTarget.showPicker()} />
                                    <input className="input-field" type="time" value={exactTime} onChange={e => setExactTime(e.target.value)} onClick={(e) => e.currentTarget.showPicker()} />
                                </div>
                            )}

                            {/* Soft past-time warning */}
                            {pastTimeWarning && (
                                <motion.div
                                    className={styles.warningBanner}
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                >
                                    <AlertTriangle size={14} />
                                    <span>This time is in the past — the email will be sent immediately</span>
                                </motion.div>
                            )}
                        </div>

                        {/* Design Card */}
                        <div className={styles.field}>
                            <label className="label"><Palette size={14} /> Email Design</label>
                            <div className={`card ${styles.designCard}`} onClick={() => setShowGallery(true)}>
                                <div className={styles.designPreview} style={{ background: selectedTheme ? selectedTheme.primaryColor : '#eee' }}>
                                    <span style={{ fontSize: 20 }}>
                                        {selectedTemplate?.layoutType === 'minimal' ? '📝' :
                                            selectedTemplate?.layoutType === 'banner' ? '🎨' :
                                                selectedTemplate?.layoutType === 'elegant' ? '✨' : '🃏'}
                                    </span>
                                </div>
                                <div className={styles.designInfo}>
                                    <div className={styles.designTitle}>{selectedTemplate?.name || 'Loading...'}</div>
                                    <div className={styles.designMeta}>{selectedTheme?.name || 'Loading...'}</div>
                                </div>
                                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>Change</button>
                            </div>
                        </div>

                        <div className={styles.actions} style={{ display: 'flex', gap: 12 }}>
                            <button className="btn-secondary" onClick={() => setStep(1)} disabled={saving}>
                                Back
                            </button>
                            <button className="btn-primary" onClick={() => handleSubmit()} disabled={saving} style={{ flex: 1 }}>
                                {saving ? 'Creating...' : (
                                    <>
                                        {isMailType ? <Send size={18} /> : <CalendarPlus size={18} />}
                                        {isMailType ? ' Schedule Mail' : ' Create Event'}
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <TemplateGallery
                isOpen={showGallery}
                onClose={() => setShowGallery(false)}
                currentTemplateId={selectedTemplateId}
                currentThemeId={selectedThemeId}
                onSelect={(tpl, thm, body) => {
                    setSelectedTemplateId(tpl);
                    setSelectedThemeId(thm);
                    if (body) setCustomMessage(body);
                }}
            />
        </div>
    );
}
