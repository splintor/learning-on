import type { LinksFunction, MetaFunction } from '@vercel/remix';
import { Form, useFetcher, useLoaderData } from '@remix-run/react';
import { assignTeacher, getData, type Student, type Teacher } from '~/googleapis.server';
import { SocialsProvider } from 'remix-auth-socials';
import { authenticator } from '~/auth.server';
import styles from "./main.css?url";
import { useReducer, useState, type MouseEvent, useEffect, useRef } from 'react';

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
  const userEmail = user?._json.email;
  if (!userEmail) {
    return {
      user,
      userEmail,
      myTeachers: [] as Teacher[],
      myStudents: [] as Student[],
    };
  }

  const data = await getData();
  const userName = data.coordinators?.find(c => c[1] === userEmail)?.[0];
  const myTeachers = userName && data.teachers ? data.teachers.filter(teacher => teacher.coordinator === userName) : [];
  const myStudents = data.students.filter(student => !student.teacher || myTeachers.some(t => t.name === student.teacher));
  myStudents.forEach(s => {
    if (s.teacher) {
      const teacher = myTeachers.find(t => t.name === s.teacher);
      if (teacher) {
        teacher.student = s.name;
      }
    }
  });

  return {
    user,
    userEmail,
    myTeachers,
    myStudents,
  };
}

// noinspection JSUnusedGlobalSymbols
export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const teacherIndex = Number(formData.get('teacherIndex'));
  const assignValue = String(formData.get('assignValue'));
  await assignTeacher({ teacherIndex, assignValue });
  return null;
}

const Available = 'זמין';

const isTeacherAvailable = (t: Teacher) => t.status === Available;
const isTeacherUnavailable = (t: Teacher) => !t.status;
const isTeacherAssigned = (t: Teacher) => Boolean(t.student);
const getTeacherWhatsappMsg = (t: Teacher) => `שלום ${t.name}, האם אפשר לשבץ אליך תלמידים לשיעורים פרטיים?`;
const getTeacherClass = (t: Teacher, selectedTeacher: Teacher | undefined) => [t === selectedTeacher ? 'selected' : '', isTeacherAssigned(t) ? 'assigned' : isTeacherAvailable(t) ? 'available' : ''].join(' ');

const isStudentAvailable = (s: Student) => s.teacher === Available;
const isStudentUnavailable = (s: Student) => !s.teacher;
const isStudentAssigned = (s: Student) => !isStudentAvailable(s) && !isStudentUnavailable(s);
const getStudentWhatsappMsg = (s: Student) => `שלום ${s.name}, האם אפשר לשבץ אליך מורה לשיעורים פרטיים?`;
const getStudentClass = (s: Student) => isStudentAssigned(s) ? 'assigned' : isStudentAvailable(s) ? 'available' : '';

const formatJoinDate = (sOrT: Pick<Student | Teacher, 'joinDate'>) => new Date(sOrT.joinDate).toLocaleDateString();

function studentMatchForTeacher(student: Student, teacher: Teacher) {
  if (student.grade.match(/[א-ו]/) && !teacher.subjects.includes('יסודי')) {
    return 0;
  }
  if (student.grade.match(/[ז-ט]/) && !teacher.subjects.includes('חטיבה')) {
    return 0;
  }
  if (student.grade.match(/(post|י|יא|יב)/) && !teacher.subjects.includes('תיכון')) {
    return 0;
  }

  const subjects = student.subjects.split(',').map(s => s.trim());
  const matching = subjects.filter(s => teacher.subjects.includes(s));
  return matching.length * 1000 - teacher.subjects.length;
}

export default function Index() {
  const fetcher = useFetcher({ key: "assign-teacher" });
  const isIdleFetcher = fetcher.state === 'idle';
  const { myStudents, myTeachers, user } = useLoaderData<typeof loader>();
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher>();
  const [includeAssigned, toggleIncludeAssigned] = useReducer((state) => !state, false);
  const teachers = myTeachers && !includeAssigned ? myTeachers.filter(t => !isTeacherAssigned(t)) : myTeachers;
  const [matchingStudents, setMatchingStudents] = useState<Student[]>([]);
  const selectedTeacherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedTeacher && !teachers.includes(selectedTeacher)) {
      setSelectedTeacher(undefined);
    }
  }, [selectedTeacher, teachers]);

  useEffect(() => {
    if (selectedTeacher && selectedTeacherRef.current) {
      selectedTeacherRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
  }, [selectedTeacher]);

  useEffect(() => {
    if (!selectedTeacher) {
      setMatchingStudents([]);
    } else {
      const assignedStudents = myStudents.filter(s => s.teacher === selectedTeacher.name);
      if (assignedStudents.length) {
        setMatchingStudents(assignedStudents);
      } else {
        const bestMatchingStudents = myStudents.map(student => ({
          student,
          match: studentMatchForTeacher(student, selectedTeacher),
        }))
          .sort((s1, s2) => s2.match - s1.match)
          .slice(0, 50)
          .map(({ student }) => student);
        setMatchingStudents(bestMatchingStudents);
      }
    }
  }, [selectedTeacher, myStudents]);

  function assignTeacher(e: MouseEvent, t: Teacher, assignValue: string) {
    e.stopPropagation();
    e.preventDefault();
    fetcher.submit({ teacherIndex: t.index, assignValue }, { method: 'POST' });
  }

  function assignStudent(e: MouseEvent, s: Student, assignValue: string) {
    e.stopPropagation();
    e.preventDefault();
    fetcher.submit({ teacherIndex: s.index, assignValue }, { method: 'POST' });
  }

  return (
    <div className="root">
      <h1>לומדים הלאה - מערכת שיבוץ</h1>
      {teachers ? <div className="main">
        {teachers.length > 0 && <div className="teachers-section">
          <div className="teachers-header">
            <a href={'#teacher-list'}>
              רשימת מורים
            </a>
          </div>
          <div className="teachers swipe-list">{
            teachers.map(t => (
              <div key={t.index} className={getTeacherClass(t, selectedTeacher)}
                   onClick={() => setSelectedTeacher(current => current === t ? undefined : t)}>
                <div className="right">
                  <div ref={t === selectedTeacher ? selectedTeacherRef : null} className="selection-element" />
                  <div className="name">{t.name}</div>
                  <div>{t.subjects}</div>
                  <div>{t.hours}</div>
                </div>
                <div className="left">
                  <div className="leftTop">
                    <div className="contact">
                      <span>
                        <a href={`tel:${t.phone}`} onClick={e => e.stopPropagation()}>{t.phone}</a>
                        <a href={`https://wa.me/${t.phone}?text=${getTeacherWhatsappMsg(t)}`}
                           onClick={e => e.stopPropagation()}>
                          <img alt="WhatsApp" src="/whatsapp.svg"/>
                        </a>
                      </span>
                    </div>
                    {t.joinDate && <div className="joinDate">
                      {formatJoinDate(t)}
                    </div>}
                  </div>
                  <div className="leftBottom">
                    {!isIdleFetcher && <div>מעדכן...</div>}
                    {isIdleFetcher && isTeacherAvailable(t) &&
                       <a href={'#markAsAvailable'} onClick={(e) => assignTeacher(e, t, '')}>סמן כלא
                         זמין</a>}
                    {isIdleFetcher && isTeacherUnavailable(t) &&
                       <a href={'#markAsUnavailable'} onClick={(e) => assignTeacher(e, t, Available)}>סמן
                         כזמין</a>}
                  </div>
                </div>
              </div>
            ))
          }</div>
          <label>
            <input type="checkbox" checked={includeAssigned} onChange={toggleIncludeAssigned}/>
            הצג גם מורים שכבר צוותו
          </label>
        </div>}

        {matchingStudents.length > 0 && <div className="students-section">
          <div className="students-header">
            {matchingStudents[0].teacher ? 'תלמידים שמשובצים ל' : 'תלמידים שרלוונטיים לשיבוץ ל'}
            <span>{selectedTeacher?.name}</span>
          </div>
          <div className="students swipe-list">{
            matchingStudents.map(s => (
              <div key={s.index} className={getStudentClass(s)}>
                <div className="right">
                  <div className="name">{s.name}</div>
                  <div>{s.subjects}</div>
                  <div>{s.hours}</div>
                </div>
                <div className="left">
                  <div className="leftTop">
                    <div className="contact">
                      <span>
                        <a href={`tel:${s.phone}`} onClick={e => e.stopPropagation()}>{s.phone}</a>
                        <a href={`https://wa.me/${s.phone}?text=${getStudentWhatsappMsg(s)}`}
                           onClick={e => e.stopPropagation()}>
                          <img alt="WhatsApp" src="/whatsapp.svg"/>
                        </a>
                      </span>
                    </div>
                    {s.joinDate && <div className="joinDate">
                      {formatJoinDate(s)}
                    </div>}
                  </div>
                  <div className="leftBottom">
                    {!isIdleFetcher && <div>מעדכן...</div>}
                    {isIdleFetcher && isStudentAvailable(s) &&
                       <a href={'#markAsAvailable'} onClick={(e) => assignStudent(e, s, '')}>סמן כלא
                         זמין</a>}
                    {isIdleFetcher && isStudentUnavailable(s) &&
                       <a href={'#markAsUnavailable'} onClick={(e) => assignStudent(e, s, Available)}>סמן
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
      </div> : <h2 className="loader">טוען נתונים...</h2>}
    </div>
  );
}
