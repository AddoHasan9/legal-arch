// ============================================================================
//  أيقونات SVG (مضمّنة لتفادي أي طلبات خارجية)
// ============================================================================
const S = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

const iconScale    = S(`<path d="M12 3v18"/><path d="M7 21h10"/><path d="M5 7h14"/><path d="M9 4l-4 3-2.5 5a3 3 0 0 0 5 0L5 7z"/><path d="M15 4l4 3 2.5 5a3 3 0 0 1-5 0L19 7z"/>`);
const iconHome     = S(`<path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10"/>`);
const iconUpload   = S(`<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>`);
const iconUploadLg = S(`<path d="M12 16V4"/><path d="M6 10l6-6 6 6"/><path d="M4 18h16"/>`);
const iconShield   = S(`<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>`);
const iconGear     = S(`<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.5L3 11a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.3 2.5h5l.3-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 .1-1z"/>`);
const iconOut      = S(`<path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>`);
const iconMenu     = S(`<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>`);
const iconSearch   = S(`<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>`);
const iconPlus     = S(`<path d="M12 5v14"/><path d="M5 12h14"/>`);
const iconEdit     = S(`<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>`);
const iconTrash    = S(`<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14"/>`);
const iconDownload = S(`<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>`);
const iconDoc      = S(`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>`);
const iconClock    = S(`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`);
const iconArrow    = S(`<path d="M15 6l-6 6 6 6"/>`);
const iconArrowBack= S(`<path d="M9 6l6 6-6 6"/>`);
const iconBuilding = S(`<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M20 21V9a2 2 0 0 0-2-2h-2"/><path d="M8 7h4M8 11h4M8 15h4"/><path d="M2 21h20"/>`);
const iconUser     = S(`<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>`);
const iconUsers    = S(`<circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a3.5 3.5 0 0 1 0 7"/><path d="M17 21a7 7 0 0 0-3-5.7"/>`);
const iconCheck    = S(`<path d="M20 6L9 17l-5-5"/>`);
const iconClose    = S(`<path d="M6 6l12 12"/><path d="M18 6L6 18"/>`);
const iconExcel    = S(`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13l6 5M15 13l-6 5"/>`);
const iconActivity = S(`<path d="M3 12h4l3 8 4-16 3 8h4"/>`);
const iconLayers   = S(`<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>`);
const iconBackup   = S(`<path d="M4 7a8 4 0 0 0 16 0"/><path d="M4 7v10a8 4 0 0 0 16 0V7"/><path d="M4 12a8 4 0 0 0 16 0"/>`);
