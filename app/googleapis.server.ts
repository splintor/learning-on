import google from '@googleapis/sheets';
import { GoogleAuth } from 'google-auth-library';

const spreadsheetId = process.env.GOOGLE_SHEET_ID;
const nativStudentsSheetName = 'תלמידים - נתיב העשרה';
const kfarAzaStudentsSheetName = 'תלמידים - כפר עזה';
const nahalOzStudentsSheetName = 'תלמידים - נחל עוז';
const teachersSheetName = 'מורים';
const coordinatorsSheetName = 'מצוותים';
const matchedSheetName = 'שיבוצים';

function getGoogleSheets() {
  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: Buffer.from(
        process.env.GOOGLE_PRIVATE_KEY as string,
        'base64'
      ).toString('ascii'),
    },
    scopes: 'https://www.googleapis.com/auth/spreadsheets',
  });

  return google.sheets({ version: 'v4', auth });
}

type Sheets = ReturnType<typeof getGoogleSheets>;

const fixPhone = (phone: string | undefined) =>
  phone?.replace(/[^\d+-]/g, '').replace(/^([1-9])/, '0$1') ?? '';

type CityName = 'נתיב העשרה' | 'כפר עזה' | 'נחל עוז';

const citySheetName: Record<CityName, string> = {
  'נתיב העשרה': nativStudentsSheetName,
  'כפר עזה': kfarAzaStudentsSheetName,
  'נחל עוז': nahalOzStudentsSheetName,
};

export type Student = {
  index: number;
  city: CityName;
  creationTime: string;
  creationDate: string;
  firstName: string;
  lastName: string;
  name: string;
  phoneNumber: string;
  email: string;
  gender: string;
  studentClass: string;
  track: string;
  primarySubject: string;
  secondarySubject: string;
  mathLevel: string;
  englishLevel: string;
  days: string;
  weekDaysHours: string;
  weekendHours: string;
  timeLength: string;
  aboutYou: string;
  tos: string;
};

export type Teacher = {
  index: number;
  creationTime: string;
  creationDate: string;
  firstName: string;
  lastName: string;
  name: string;
  phoneNumber: string;
  email: string;
  gender: string;
  hasTeachingCert: string;
  teachingExperience: string;
  track: string;
  bagrutTrack: string;
  subjects: string;
  mathLevel: string;
  englishLevel: string;
  days: string;
  weekDaysHours: string;
  weekendHours: string;
  timeLength: string;
  hasTaught: string;
  howWasTeachingWithUs: string;
  isOKToMakeACall: string;
  aboutMe: string;
  openingCallWith: string;
  openingCallInsights: string;
  matchBy: string;
  matchedStudent: string;
};

export type Match = {
  index: number;
  student: string;
  teacher: string;
  subject?: string;
  coordinator: string;
  coordinationDate: Date;
};

export async function getData() {
  try {
    const sheets = getGoogleSheets();
    const [
      nativStudentRows,
      kfarAzaStudentRows,
      nahalOzStudentRows,
      teacherRows,
      coordinators,
      matchesRows,
    ] = await Promise.all([
      getValues(sheets, `${nativStudentsSheetName}!A2:U`),
      getValues(sheets, `${kfarAzaStudentsSheetName}!A2:U`),
      getValues(sheets, `${nahalOzStudentsSheetName}!A2:U`),
      getValues(sheets, `${teachersSheetName}!A2:AA`),
      getValues(sheets, `${coordinatorsSheetName}!A2:C`),
      getValues(sheets, `${matchedSheetName}!A2:E`),
    ]);

    const parseStudentRows = (
      studentRows: any[][] | null | undefined,
      city: CityName
    ) =>
      studentRows?.map<Student>((row, index) => {
        let fieldIndex = -1;
        return {
          index,
          city,
          creationDate: row[++fieldIndex],
          creationTime: row[++fieldIndex],
          firstName: row[++fieldIndex],
          lastName: row[++fieldIndex],
          name: row[++fieldIndex],
          phoneNumber: row[++fieldIndex],
          email: row[++fieldIndex],
          gender: row[++fieldIndex],
          studentClass: row[++fieldIndex],
          track: row[++fieldIndex],
          primarySubject: row[++fieldIndex],
          secondarySubject: row[++fieldIndex],
          mathLevel: row[++fieldIndex],
          englishLevel: row[++fieldIndex],
          days: row[++fieldIndex],
          weekDaysHours: row[++fieldIndex],
          weekendHours: row[++fieldIndex],
          timeLength: row[++fieldIndex],
          aboutYou: row[++fieldIndex],
          tos: row[++fieldIndex],
        };
      }) ?? [];

    const students = [
      ...parseStudentRows(nativStudentRows, 'נתיב העשרה'),
      ...parseStudentRows(kfarAzaStudentRows, 'כפר עזה'),
      ...parseStudentRows(nahalOzStudentRows, 'נחל עוז'),
    ];

    const teachers = teacherRows?.map<Teacher>((row, index) => {
      let fieldIndex = -1;
      return {
        index,
        creationDate: row[++fieldIndex],
        creationTime: row[++fieldIndex],
        firstName: row[++fieldIndex],
        lastName: row[++fieldIndex],
        name: row[++fieldIndex],
        phoneNumber: fixPhone(row[++fieldIndex]),
        email: row[++fieldIndex],
        gender: row[++fieldIndex],
        hasTeachingCert: row[++fieldIndex],
        teachingExperience: row[++fieldIndex],
        track: row[++fieldIndex],
        bagrutTrack: row[++fieldIndex],
        subjects: row[++fieldIndex],
        mathLevel: row[++fieldIndex],
        englishLevel: row[++fieldIndex],
        days: row[++fieldIndex],
        weekDaysHours: row[++fieldIndex],
        weekendHours: row[++fieldIndex],
        timeLength: row[++fieldIndex],
        hasTaught: row[++fieldIndex],
        howWasTeachingWithUs: row[++fieldIndex],
        isOKToMakeACall: row[++fieldIndex],
        aboutMe: row[++fieldIndex],
        openingCallWith: row[++fieldIndex],
        openingCallInsights: row[++fieldIndex],
        matchBy: row[++fieldIndex],
        matchedStudent: row[++fieldIndex],
      };
    });

    const matches = matchesRows?.map<Match>((row, index) => {
      let fieldIndex = -1;
      return {
        index,
        student: row[++fieldIndex],
        teacher: row[++fieldIndex],
        subject: row[++fieldIndex],
        coordinator: row[++fieldIndex],
        coordinationDate: new Date(row[++fieldIndex]),
      };
    });

    return { students, teachers, coordinators, matches };
  } catch (err) {
    console.error('Failed to get list of names', err);
    throw err;
  }
}

async function getValues(sheets: Sheets, range: string) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return response.data.values;
  } catch (err) {
    throw new Error(`Get values failed. Info: ${err}`);
  }
}

export async function assignTeacher({
  teacherIndex,
  assignValue,
}: {
  teacherIndex: number;
  assignValue: string;
}) {
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

export async function assignStudent({
  studentCity,
  studentIndex,
  assignValue,
}: {
  studentCity: CityName;
  studentIndex: number;
  assignValue: string;
}) {
  try {
    const sheets = getGoogleSheets();
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${citySheetName[studentCity]}!O${studentIndex + 2}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[assignValue]] },
    });
  } catch (err) {
    console.error('Failed to assign student', err);
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
