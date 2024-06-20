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

export async function getData() {
  try {
    const sheets = getGoogleSheets();
    const [students, teachers, coordinators] = await Promise.all([
      getValues(sheets,  `${studentsSheetName}!A:U`),
      getValues(sheets, `${teachersSheetName}!A:Z`),
      getValues(sheets, `${coordinatorsSheetName}!A:A`),
    ]);

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
