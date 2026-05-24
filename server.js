import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ─── Путь к фронтенду ───────────────────────────────────────────────────────
let frontendPath = path.join(__dirname, 'public');
console.log(`[SYSTEM] Статика из: ${frontendPath}`);
app.use(express.static(frontendPath));

// ─── Проверка API-ключа ──────────────────────────────────────────────────────
if (!process.env.GEMINI_API_KEY) {
    console.error('КРИТИЧЕСКАЯ ОШИБКА: GEMINI_API_KEY не задан в .env');
    process.exit(1);
}

// ─── ШАГ 1: Загрузка базы данных ────────────────────────────────────────────
const dbPath = path.join(__dirname, 'uzbek_students_database.json');
let DB = {};
try {
    DB = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    console.log(`[DB] База загружена: ${DB.database_info?.total_cases} кейсов`);
} catch (e) {
    console.error('[DB] Ошибка загрузки базы:', e.message);
}

// ─── Формирование контекста базы для промпта ─────────────────────────────────
function buildDatabaseContext() {
    const students = DB.students || [];
    const patterns = DB.key_patterns || {};
    const messages = DB.motivational_messages_by_region || {};

    const casesSummary = students.map(s =>
        `${s.name} → ${s.university_admitted} ($${(s.scholarship_amount_usd || 0).toLocaleString()} стипендия)
  Из: ${s.hometown} (${s.region}) | Школа: ${s.high_school} | Программа: ${s.curriculum}
  Ключевые факторы: ${s.key_differentiators?.join(', ') || 'нет данных'}`
    ).join('\n\n');

    const patternsSummary = Object.values(patterns)
        .filter(p => p.name)
        .map(p => `• ${p.name}: ${p.description}`)
        .join('\n');

    const messagesSummary = Object.entries(messages)
        .map(([city, msg]) => `  ${city}: "${msg}"`)
        .join('\n');

    return `
=== РЕАЛЬНЫЕ КЕЙСЫ УЗБЕКСКИХ СТУДЕНТОВ ===
${casesSummary}

=== КЛЮЧЕВЫЕ ПАТТЕРНЫ ПОСТУПЛЕНИЯ ===
${patternsSummary}

=== МОТИВАЦИОННЫЕ ИНСАЙТЫ ПО ГОРОДАМ ===
${messagesSummary}

=== ФИНАНСОВЫЕ ФАКТЫ ===
• MIT, Harvard, Princeton, Brown, Yale, Columbia, UPenn: покрывают 100% подтверждённой нужды
• При budget = $0 — НЕ убирай Ivy League. Они покрывают всё.
• ETH Zurich: ~$800 в год суммарно, QS Top-10 по инженерии
• Узбекские студенты с Harvard получили $366K (Abdulaziz), $376K (Brown/Allomakhon)

=== УЗБЕКСКИЕ ВОЗМОЖНОСТИ (используй реальные названия) ===
• Zakovat Students League: регистрация открывается в сентябре каждого года
• UWC Uzbekistan: подача в январе (полная IB + проживание)
• Республиканские олимпиады: математика, физика, химия, информатика, биология
• PASCH/Goethe-Institut: подача в феврале (Германия, летний лагерь)
• DAAD: дедлайн октябрь (Германия, ~$800/год обучение)
• Chevening UK: дедлайн ноябрь
• Fulbright: дедлайн февраль
`;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ─── Главная страница ────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// ─── API: Генерация роадмапа ─────────────────────────────────────────────────
app.post('/api/generate-roadmap', async (req, res) => {
    try {
        // Extract all fields from request
        const p = req.body; // full profile object
        const {
            name, city, grade, gpa_uzbek,
            ielts_score, sat_score, olympiads,
            dream_university, budget_raw
        } = p;

        // Build GPA string
        let gpaString = '';
        if (p?.gpa?.mode === 'subjects' && p.gpa.subjects) {
            gpaString = 'По предметам: ' + Object.entries(p.gpa.subjects).map(([k,v]) => `${k}=${v}`).join(', ');
        } else {
            gpaString = `${gpa_uzbek || p?.gpa?.value || '?'}/5.0 (общий)`;
        }

        if (!name || !dream_university) {
            return res.status(400).json({ success: false, error: 'Укажи имя и университет.' });
        }

        console.log(`[API] Запрос: ${name} → ${dream_university} | IELTS: ${ielts_score} | SAT: ${sat_score}`);


        // ─── ШАГ 1+2: Системный промпт с базой данных ───────────────────────
        const systemInstruction = `
Ты — Next Step AI, единственный в мире AI-консультант по поступлению в топ-университеты, созданный специально для студентов из Узбекистана.

ПРОФИЛЬ СТУДЕНТА:
- Имя: ${name}
- Город: ${city || 'не указан'}
- Класс: ${grade}
- Тип школы: ${p?.school_type || 'не указан'}
- Учебная программа: ${p?.curriculum || 'не указана'}
- GPA: ${gpaString}
- Место в классе: ${p?.class_rank || 'не указано'}
- Часов учёбы в день: ${p?.study_hours || 'не указано'}
- IELTS/TOEFL: ${ielts_score}
- SAT/ACT: ${sat_score}
- Русский язык: ${p?.russian_level || 'не указан'}
- Немецкий язык: ${p?.german_level || 'нет'}
- Другие языки: ${p?.other_lang || 'нет'}
- Олимпиады: ${olympiads || 'нет'}
- Внеклассные активности: ${p?.extracurriculars || 'не указаны'}
- Работа/стажировка: ${p?.work_experience || 'нет'}
- Независимый проект: ${p?.independent_project || 'нет'}
- Лидерская роль: ${p?.leadership || 'нет'}
- Международный опыт: ${p?.international_exp || 'нет'}
- Целевая специальность: ${p?.target_major || 'не указана'}
- Бюджет: ${budget_raw} USD/год (0 = нужна полная стипендия)
- Первый в семье с дипломом: ${p?.first_gen || 'нет'}
- Год подачи документов: ${p?.application_year || 'не указан'}
- Доп. информация: ${p?.additional_info || 'нет'}
- Цель: ${dream_university}

${buildDatabaseContext()}

ПРАВИЛА АНАЛИЗА:
1. Сравни профиль студента с РЕАЛЬНЫМИ кейсами из базы выше. Найди наиболее похожий.
2. Если IELTS или SAT не сданы (not_taken) — шанс сейчас 10-25%, после плана — 65-85%.
3. При budget=$0 — НЕ убирай Ivy League. Пиши "full funding available".
4. top_3_gaps: конкретные пробелы именно для целевого вуза (${dream_university}).
5. Каждая задача роадмапа — конкретное действие с реальным ресурсом из Узбекистана.
6. motivational_insight ОБЯЗАТЕЛЬНО упоминает конкретный город студента (${city}).
7. comparable_case — только если совпадение реальное (город, тип школы, GPA).

ЗАПРЕЩЕНО: эмодзи, markdown, вводные слова. Только чистый JSON.
        `.trim();

        // ─── ШАГ 2: Расширенная схема с top_3_gaps и comparable_case ────────
        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                student_name: { type: Type.STRING },
                dream_university: { type: Type.STRING },
                gap_analysis: {
                    type: Type.OBJECT,
                    properties: {
                        admission_chance_now: { type: Type.STRING },
                        admission_chance_after_plan: { type: Type.STRING },
                        current_profile_summary: { type: Type.STRING },
                        // ШАГ 2: Новые поля
                        top_3_gaps: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    gap: { type: Type.STRING },
                                    why_it_matters: { type: Type.STRING },
                                    severity: { type: Type.STRING } // critical | important | minor
                                },
                                required: ['gap', 'why_it_matters', 'severity']
                            }
                        },
                        comparable_case: { type: Type.STRING }
                    },
                    required: ['admission_chance_now', 'admission_chance_after_plan', 'current_profile_summary', 'top_3_gaps', 'comparable_case']
                },
                roadmap: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            month: { type: Type.INTEGER },
                            month_label: { type: Type.STRING },
                            title: { type: Type.STRING },
                            main_task: { type: Type.STRING },
                            why_this_matters: { type: Type.STRING },
                            difficulty: { type: Type.STRING },
                            time_required: { type: Type.STRING },
                            deadline: { type: Type.STRING },
                            resource: { type: Type.STRING }
                        },
                        required: ['month', 'month_label', 'title', 'main_task', 'why_this_matters', 'difficulty', 'time_required', 'deadline', 'resource']
                    }
                },
                motivational_insight: { type: Type.STRING }
            },
            required: ['student_name', 'dream_university', 'gap_analysis', 'roadmap', 'motivational_insight']
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Сгенерируй детальный персонализированный план поступления.',
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema,
                temperature: 0.3
            }
        });

        const responseText = response.text?.trim();
        if (!responseText) throw new Error('Gemini вернул пустой ответ.');

        const parsedData = JSON.parse(responseText);
        return res.json({ success: true, data: parsedData });

    } catch (error) {
        console.error('ОШИБКА СЕРВЕРА:', error);
        return res.status(500).json({ success: false, error: 'Ошибка генерации: ' + error.message });
    }
});


// ─── Chat endpoint ───────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
    try {
        const { context, history } = req.body;
        if (!context || !history) return res.status(400).json({ error: 'Missing params' });

        const messages = history.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: messages,
            config: {
                systemInstruction: context,
                temperature: 0.5,
                maxOutputTokens: 300
            }
        });

        const reply = response.text?.trim() || 'Не удалось получить ответ.';
        return res.json({ success: true, reply });
    } catch (e) {
        console.error('[CHAT ERROR]', e.message);
        return res.status(500).json({ success: false, reply: 'Ошибка сервера: ' + e.message });
    }
});

app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`[SERVER] http://localhost:${PORT}`);
    console.log(`===================================================`);
});