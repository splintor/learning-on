import google from '@googleapis/sheets';
import { GoogleAuth } from 'google-auth-library';

const spreadsheetId = process.env.GOOGLE_SHEET_ID;
const studentsSheetName = 'תלמידים';
const teachersSheetName = 'מורים';
const coordinatorsSheetName = 'מצוותים';

function getGoogleSheets() {
  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: Buffer.from(process.env.GOOGLE_PRIVATE_KEY as string, 'base64').toString('ascii'),
    },
    scopes: 'https://www.googleapis.com/auth/spreadsheets',
  });

  return google.sheets({ version: 'v4', auth });
}

type Sheets = ReturnType<typeof getGoogleSheets>;

const fixPhone = (phone: string | undefined) => phone ? phone.match(/^[+0]/) ? phone : '0' + phone : '';

function parseDate(dmy: string | undefined) {
  if (!dmy) {
    return '';
  }
  const parts = dmy.split('/').map(Number);
  return new Date(parts[2], parts[1] - 1, parts[0]).toISOString();
}

export type Student = {
  index: number;
  name: string;
  city: string;
  grade: string;
  subjects: string;
  phone: string;
  teacher: string;
  details: string;
  hours: string;
  comment: string;
  joinDate: string;
}

export type Teacher = {
  index: number;
  name: string;
  phone: string;
  subjects: string;
  hours: string;
  background: string;
  comment: string;
  joinDate: string;
  status: string;
  student?: string;
  coordinator: string;
}

export async function getData() {
  try {
    const sheets = getGoogleSheets();
    const [studentRows, teacherRows, coordinators] = await Promise.all([
      getValues(sheets, `${studentsSheetName}!A2:U`),
      getValues(sheets, `${teachersSheetName}!A2:AC`),
      getValues(sheets, `${coordinatorsSheetName}!A2:B`),
    ]);

    const students = studentRows?.map<Student>((row, index) => ({
      index,
      name: row[0],
      city: row[1],
      grade: row[2] || '',
      subjects: row[12] || '',
      phone: fixPhone(row[13]),
      teacher: row[14],
      details: row[16],
      hours: row[17],
      comment: row[19],
      joinDate: parseDate(row[20]),
    })) ?? [];

    const teachers = teacherRows?.map<Teacher>((row, index) => ({
      index,
      name: row[0],
      phone: fixPhone(row[1]),
      subjects: row[15]?.replace(/\\ [A-Z]*/ig, '') || '',
      hours: row[19],
      background: row[20],
      comment: row[22],
      joinDate: parseDate(row[25]),
      status: row[27],
      coordinator: row[28],
    }));

    return { students, teachers, coordinators };
  } catch (err) {
    console.error('Failed to get list of names', err);
    throw err;
  }
}

async function getValues(sheets: Sheets, range: string) {
  try {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return response.data.values;
  } catch (err) {
    throw new Error(`Get values failed. Info: ${err}`);
  }
}

export async function assignTeacher({ teacherIndex, assignValue }: { teacherIndex: number, assignValue: string }) {
  try {
    const sheets = getGoogleSheets();
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${teachersSheetName}!AB${teacherIndex + 2}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[assignValue]] },
    });
  } catch (err) {
    console.error('Failed to assign teacher', err);
    throw err;
  }
}

// export async function saveForm({ senderName, fadiha = 'לא', names = [], sum }: Record<string, string | string[]>) {
//   try {
//     if (process.env.DO_NOT_SAVE_TO_WORKSHEET) {
//       console.log('Note: DO_NOT_SAVE_TO_WORKSHEET env var is set to true - skipping saving to worksheet.');
//       return;
//     }
//
//     const sheets = getGoogleSheets();
//     await sheets.spreadsheets.values.append({
//       spreadsheetId,
//       range: `${registrationsSheetName}!A:A`,
//       valueInputOption: 'RAW',
//       requestBody: { values: [[new Date().toISOString(), senderName, fadiha, (names as string[]).join(','), sum]] },
//     });
//     // await processShipping(sheets);
//   } catch (err) {
//     console.error('Failed to add submission', err);
//     throw err;
//   }
// }

// export async function updateShipping() {
//   try {
//     const sheets = getGoogleSheets();
//     // await processShipping(sheets);
//   } catch (err) {
//     console.error('Failed to update shipping', err);
//     throw err;
//   }
// }


// export const updateTeacherForStudent = webMethod(Permissions.Anyone, async (studentRowIndex, teacherName) => {
//   try {
//     const sheetId = await getSecretSheetId();
//     const result = await updateValues(sheetId, [teacherName], `תלמידים!O${studentRowIndex + 1}`, 'ROWS');
//     return result.data;
//   } catch (err) {
//     return Promise.reject("Update values failed. Info: " + err);
//   }
// })
