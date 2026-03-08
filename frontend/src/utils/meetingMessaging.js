import { format, parseISO } from 'date-fns';

const parseDateSafe = (value) => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const text = String(value).trim();
    if (!text) return null;
    const parsedIso = parseISO(text);
    if (!Number.isNaN(parsedIso.getTime())) return parsedIso;
    const parsedNative = new Date(text);
    if (!Number.isNaN(parsedNative.getTime())) return parsedNative;
    return null;
};

export const formatDateSafe = (value, fmt = 'd MMMM yyyy', fallback = 'TBD') => {
    const parsed = parseDateSafe(value);
    if (!parsed) return fallback;
    try {
        return format(parsed, fmt);
    } catch {
        return fallback;
    }
};

export const normalizeWhatsAppNumber = (value) => {
    let digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0') && digits.length > 10) digits = digits.replace(/^0+/, '');
    if (digits.length === 10) digits = `91${digits}`;
    return digits;
};

export const buildWhatsAppSendUrl = (number, message) => {
    const phone = normalizeWhatsAppNumber(number);
    const encoded = encodeURIComponent(String(message || '').trim());
    if (!phone) {
        return `https://api.whatsapp.com/send/?text=${encoded}&type=custom_url&app_absent=0`;
    }
    return `https://api.whatsapp.com/send/?phone=${phone}&text=${encoded}&type=phone_number&app_absent=0`;
};

export const buildMeetingAgendaMessage = ({
    departmentName,
    meeting = {},
    agendaSnapshot = [],
}) => {
    const deptText = String(departmentName || '').trim() || 'Department';
    const dateText = formatDateSafe(meeting?.scheduled_date, 'd MMMM yyyy', 'TBD');
    const timeText = String(meeting?.scheduled_time || '').trim();
    const venueText = String(meeting?.venue || '').trim();
    const attendeesText = String(meeting?.attendees || '').trim();
    const notesText = String(meeting?.notes || '').trim();
    const agendaRows = Array.isArray(agendaSnapshot) ? agendaSnapshot : [];
    const agendaText = agendaRows.length
        ? agendaRows.map((a, idx) => {
            const title = String(a?.title || '').trim() || 'Agenda Item';
            const details = String(a?.details || '').trim();
            return `${idx + 1}. ${title}${details ? `\n   - ${details}` : ''}`;
        }).join('\n')
        : 'No agenda points attached.';

    return `Meeting Agenda - ${deptText}\nDate: ${dateText}${timeText ? `\nTime: ${timeText}` : ''}${venueText ? `\nVenue: ${venueText}` : ''}${attendeesText ? `\nAttendees: ${attendeesText}` : ''}\n\nAgenda Points:\n${agendaText}${notesText ? `\n\nNotes:\n${notesText}` : ''}\n\nPlease ensure your presence and come prepared.`;
};
