import type { LinksFunction, MetaFunction } from '@vercel/remix';
import { Form, useFetcher, useLoaderData } from '@remix-run/react';
import { assignTeacher, getData, type Teacher } from '~/googleapis.server';
import { SocialsProvider } from 'remix-auth-socials';
import { authenticator } from '~/auth.server';
import styles from "./main.css?url";
import { useReducer, useState, type MouseEvent } from 'react';


// noinspection JSUnusedGlobalSymbols
export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];

// noinspection JSUnusedGlobalSymbols
export const meta: MetaFunction = () => {
  return [
    { title: "לומדים הלאה - שיבוץ שיעורים" },
    { name: "description", content: "מערכת לשיבוץ מורים ותלמידים בפרוייקט לומדים הלאה Learning On" },
  ];
};

export async function loader({ request }: { request: Request }) {
  const user = await authenticator.isAuthenticated(request);
  const data = await getData();
  const userEmail = user?._json.email;
  const userName = data.coordinators?.find(c => c[1] === userEmail)?.[0];
  // const isPermitted = data.coordinators?.[0]?.includes(userEmail ?? '');
  const myTeachers = userName ? data.teachers?.filter(teacher => teacher.coordinator === userName) : [];

  return {
    user,
    userEmail,
    myTeachers,
    students: data.students,
  };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const teacherIndex = Number(formData.get('teacherIndex'));
  const assignValue = String(formData.get('assignValue'));
  await assignTeacher({ teacherIndex, assignValue });
  return null;
}

const Available = 'זמין';

const isTeacherAvailable = (t: Pick<Teacher, 'student'>) => t.student === Available;
const isTeacherUnavailable = (t: Pick<Teacher, 'student'>) => !t.student;
const isTeacherAssigned = (t: Pick<Teacher, 'student'>) => !isTeacherAvailable(t) && !isTeacherUnavailable(t)
const getTeachWhatsappMsg = (t: Teacher) => `שלום ${t.name}, האם אפשר לשבץ אליך תלמידים לשיעורים פרטיים?`;
const getTeacherClass = (t: Teacher, selectedTeacher: Teacher | undefined) => [t === selectedTeacher ? 'selected' : '', isTeacherAssigned(t) ? 'assigned' : isTeacherAvailable(t) ? 'available': ''].join(' ');

export default function Index() {
  const fetcher = useFetcher({ key: "assign-teacher" });
  const isIdleFetcher = fetcher.state === 'idle';
  const { myTeachers, user } = useLoaderData<typeof loader>();
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher>();
  const [includeAssigned, toggleIncludeAssigned] = useReducer((state) => !state, false);
  const teachers = myTeachers && !includeAssigned ? myTeachers.filter(t => !isTeacherAssigned(t)) : myTeachers;

  function assignTeacher(e: MouseEvent, t: Pick<Teacher, 'index'>, assignValue: string) {
    e.stopPropagation();
    e.preventDefault();
    fetcher.submit({ teacherIndex: t.index, assignValue }, { method: 'POST'});
  }

  return (
    <div className="root">
      <h1>לומדים הלאה - מערכת שיבוץ</h1>
      {!myTeachers && <h2 className="loader">טוען נתונים...</h2>}
      {teachers && <div className="main">
        {teachers.length > 0 && <div>
          <div className="teachers-header">
            <a href={'#teacher-list'}>
              רשימת מורים
            </a>
            <label>
              <input type="checkbox" checked={includeAssigned} onChange={toggleIncludeAssigned}/>
              הצג גם מורים שכבר צוותו
            </label>
          </div>
          <div className="teachers">{
            teachers.map(t => (
              <div key={t.index} className={getTeacherClass(t as Teacher, selectedTeacher)} onClick={() => setSelectedTeacher(t as Teacher)}>
                <div className="right">
                  <div className="name">{t.name}</div>
                  <div>{t.subjects}</div>
                  <div>{t.hours}</div>
                </div>
                <div className="left">
                  <div className="leftTop">
                    <div className="contact">
                      <span>
                        <a href={`tel:${t.phone}`} onClick={e => e.stopPropagation()}>{t.phone}</a>
                        <a href={`https://wa.me/${t.phone}?text=${getTeachWhatsappMsg(t as Teacher)}`} onClick={e => e.stopPropagation()}>
                          <img alt="WhatsApp" src="/whatsapp.svg" />
                        </a>
                      </span>
                    </div>
                    {t.joinDate && <div className="joinDate">
                      {new Date(t.joinDate).toLocaleDateString()}
                    </div>}
                  </div>
                  <div className="leftBottom">
                    { !isIdleFetcher && <div>מעדכן...</div>}
                      { isIdleFetcher && isTeacherAvailable(t) &&
                         <a href={'#markAsAvailable'} onClick={(e) => assignTeacher(e, t, '')}>סמן כלא
                           זמין</a>}
                      { isIdleFetcher && isTeacherUnavailable(t) &&
                         <a href={'#markAsUnavailable'} onClick={(e) => assignTeacher(e, t, Available)}>סמן
                           כזמין</a>}
                  </div>
                </div>
              </div>
            ))
          }</div>
        </div>}

        {user && !teachers?.length &&
           <Form
              method="post"
              action={`/logout`}
              className="message warning"
           >
             <h2>
               <div>שלום {user.displayName}, אין מורים שמצוותים אליך במערכת.</div>
               <button>יציאה</button>
             </h2>
           </Form>}

        {!user && <Form
           method="post"
           action={`/auth/${SocialsProvider.GOOGLE}`}
           className="message"
        >
          <h2>
            <div>כדי להשתמש במערכת יש להכנס.</div>
            <button>כניסה</button>
          </h2>
        </Form>}
      </div>}
    </div>
  );
}
