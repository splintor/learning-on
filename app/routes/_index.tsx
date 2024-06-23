import React, {
  useReducer,
  useState,
  type MouseEvent,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { LinksFunction, MetaFunction } from '@vercel/remix';
import { Form, useFetcher, useLoaderData } from '@remix-run/react';
import {
  assignStudent,
  assignTeacher,
  getData,
  type Student,
  type Teacher,
} from '~/googleapis.server';
import { SocialsProvider } from 'remix-auth-socials';
import { authenticator } from '~/auth.server';
import styles from './main.css?url';
import { ToastContainer, Zoom, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// noinspection JSUnusedGlobalSymbols
export const links: LinksFunction = () => [{ rel: 'stylesheet', href: styles }];

// noinspection JSUnusedGlobalSymbols
export const meta: MetaFunction = () => {
  return [
    { title: 'לומדים הלאה - שיבוץ שיעורים' },
    {
      name: 'description',
      content: 'מערכת לשיבוץ מורים ותלמידים בפרוייקט לומדים הלאה Learning On',
    },
  ];
};

export async function loader({ request }: { request: Request }) {
  const user = await authenticator.isAuthenticated(request);
  const userEmail = user?._json.email;
  const ownerEmail = process.env.OWNER_EMAIL;
  const ownerPhone = process.env.OWNER_PHONE;
  if (!userEmail) {
    return {
      user,
      userEmail,
      myTeachers: [] as Teacher[],
      myStudents: [] as Student[],
      ownerEmail,
      ownerPhone,
    };
  }

  const data = await getData();
  const userName = data.coordinators?.find(c => c[1] === userEmail)?.[0];
  const myTeachers =
    userName && data.teachers
      ? data.teachers.filter(teacher => teacher.coordinator === userName)
      : [];
  const myStudents = data.students.filter(
    student =>
      !isStudentAssigned(student) ||
      myTeachers.some(t => t.name === student.teacher)
  );
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
    ownerEmail,
    ownerPhone,
  };
}

// noinspection JSUnusedGlobalSymbols
export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const teacherIndex = Number(formData.get('teacherIndex'));
  const studentIndex = Number(formData.get('studentIndex'));
  const assignValue = String(formData.get('assignValue'));
  if (teacherIndex) {
    await assignTeacher({ teacherIndex, assignValue });
  } else {
    await assignStudent({ studentIndex, assignValue });
  }
  return null;
}

const Available = 'זמין';

const isTeacherAvailable = (t: Teacher) => t.status === Available;
const isTeacherAssigned = (t: Teacher) => Boolean(t.student);
const getTeacherWhatsappMsg = (t: Teacher) =>
  `שלום ${t.name}, האם אפשר לשבץ אליך תלמידים לשיעורים פרטיים?`;
const getTeacherClass = (t: Teacher, selectedTeacher: Teacher | undefined) =>
  [
    t === selectedTeacher ? 'selected' : '',
    isTeacherAssigned(t)
      ? 'assigned'
      : isTeacherAvailable(t)
      ? 'available'
      : '',
  ].join(' ');

const isStudentAvailable = (s: Student) => s.teacher === Available;
const isStudentUnavailable = (s: Student) => !s.teacher;
const isStudentAssigned = (s: Student) =>
  !isStudentAvailable(s) && !isStudentUnavailable(s);
const getStudentWhatsappMsg = (s: Student) =>
  `שלום ${s.name}, האם אפשר לשבץ אליך מורה לשיעורים פרטיים?`;
const getStudentClass = (s: Student) =>
  isStudentAssigned(s) ? 'assigned' : isStudentAvailable(s) ? 'available' : '';

const formatJoinDate = (sOrT: Pick<Student | Teacher, 'joinDate'>) =>
  new Date(sOrT.joinDate).toLocaleDateString();

function studentMatchForTeacher(student: Student, teacher: Teacher) {
  if (student.grade.match(/[א-ו]/) && !teacher.subjects.includes('יסודי')) {
    return -1000;
  }
  if (student.grade.match(/[ז-ט]/) && !teacher.subjects.includes('חטיבה')) {
    return -1000;
  }
  if (
    student.grade.match(/(post|י|יא|יב)/) &&
    !teacher.subjects.includes('תיכון')
  ) {
    return -1000;
  }

  const subjects = student.subjects.split(',').map(s => s.trim());
  const matching = subjects.filter(s => teacher.subjects.includes(s));
  return matching.length * 1000 - teacher.subjects.length;
}

export default function Index() {
  const teacherFetcher = useFetcher({ key: 'assign-teacher' });
  const isTeacherFetcherIdle = teacherFetcher.state === 'idle';
  const studentFetcher = useFetcher({ key: 'assign-student' });
  const isStudentFetcherIdle = studentFetcher.state === 'idle';
  const { myStudents, myTeachers, user, userEmail, ownerEmail, ownerPhone } =
    useLoaderData<typeof loader>();
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher>();
  const [includeAssigned, setIncludeAssigned] = useState(false);
  const teachers =
    myTeachers && !includeAssigned
      ? myTeachers.filter(
          t => !isTeacherAssigned(t) || t.name === selectedTeacher?.name
        )
      : myTeachers;
  const [matchingStudents, setMatchingStudents] = useState<Student[]>([]);
  const selectedTeacherRef = useRef<HTMLDivElement>(null);
  const studentsSwipeRef = useRef<HTMLDivElement>(null);
  const [studentAssignToast, setStudentAssignToast] = useState<ReactNode>();
  const [isAboutModalOpen, toggleAboutModalOpen] = useReducer(
    state => !state,
    false
  );
  const [isTeachersListModalOpen, toggleTeachersListModalOpen] = useReducer(
    state => !state,
    false
  );
  const [teachersSearch, setTeachersSearch] = useState<string>();

  useEffect(() => {
    if (selectedTeacher) {
      setSelectedTeacher(teachers.find(t => t.name === selectedTeacher.name));
    }
  }, [selectedTeacher, teachers]);

  useEffect(() => {
    if (teachers.length === 0 && myTeachers.length > 0 && !includeAssigned) {
      setIncludeAssigned(true);
    }
  }, [includeAssigned, myTeachers.length, teachers.length]);

  useEffect(() => {
    if (selectedTeacher && selectedTeacherRef.current) {
      setTimeout(() =>
        selectedTeacherRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'start',
        })
      );
    }
  }, [selectedTeacher]);

  useEffect(() => {
    if (isTeacherFetcherIdle && studentAssignToast) {
      toast.success(studentAssignToast);
      setStudentAssignToast(undefined);
    }
  }, [studentAssignToast, isTeacherFetcherIdle]);

  useEffect(() => {
    if (!selectedTeacher) {
      setMatchingStudents([]);
    } else {
      const assignedStudents = myStudents.filter(
        s => s.teacher === selectedTeacher.name
      );
      if (assignedStudents.length) {
        setMatchingStudents(assignedStudents);
      } else {
        const bestMatchingStudents = myStudents
          .filter(s => !isStudentAssigned(s))
          .map(s => ({
            student: s,
            match: studentMatchForTeacher(s, selectedTeacher),
          }))
          .sort((s1, s2) => s2.match - s1.match)
          .slice(0, 50)
          .map(({ student }) => student);
        setMatchingStudents(bestMatchingStudents);
      }
    }
  }, [selectedTeacher, myStudents]);

  useEffect(() => {
    if (studentsSwipeRef.current) {
      studentsSwipeRef.current.scrollLeft = 0;
    }
  }, [selectedTeacher?.name]);

  function assignTeacher(e: MouseEvent, t: Teacher, assignValue: string) {
    e.stopPropagation();
    e.preventDefault();
    teacherFetcher.submit(
      { teacherIndex: t.index, assignValue },
      { method: 'POST' }
    );
  }

  function assignStudent(e: MouseEvent, s: Student, assignValue: string) {
    e.stopPropagation();
    e.preventDefault();
    studentFetcher.submit(
      { studentIndex: s.index, assignValue },
      { method: 'POST' }
    );

    const origValue = s.teacher;
    const cancelFn = () => assignStudent(e, s, origValue);
    if (isStudentAssigned(s)) {
      setStudentAssignToast(
        <div className="toast">
          השיבוץ של {s.name} ל{selectedTeacher?.name} בוטל בהצלחה.{' '}
          <a href={'#re-assign'} onClick={cancelFn}>
            שבץ מחדש
          </a>
        </div>
      );
    } else if (assignValue && assignValue !== Available) {
      setStudentAssignToast(
        <div className="toast">
          {s.name} שובץ בהצלחה ל{selectedTeacher?.name}
          <a href={'#re-assign'} onClick={cancelFn}>
            בטל
          </a>
        </div>
      );
    }
    s.teacher = assignValue;
  }

  return (
    <div className="root">
      <h1 onClick={toggleAboutModalOpen}>לומדים הלאה - מערכת שיבוץ</h1>
      {teachers ? (
        <div className="main">
          {teachers.length > 0 && (
            <div className="teachers-section">
              <div className="teachers-header">
                <a
                  href={'#teacher-list'}
                  onClick={e => {
                    e.preventDefault();
                    toggleTeachersListModalOpen();
                  }}
                >
                  רשימת מורים
                </a>
              </div>
              <div className="teachers swipe-list">
                {teachers.map(t => (
                  <div
                    key={t.index}
                    className={getTeacherClass(t, selectedTeacher)}
                    onClick={() =>
                      setSelectedTeacher(current =>
                        current === t ? undefined : t
                      )
                    }
                  >
                    <div className="right">
                      <div
                        ref={t === selectedTeacher ? selectedTeacherRef : null}
                        className="selection-element"
                      />
                      <div className="name">{t.name}</div>
                      <div className="details">
                        <div>{t.subjects}</div>
                        <div>{t.hours}</div>
                      </div>
                    </div>
                    <div className="left">
                      <div className="leftTop">
                        <div className="contact">
                          <span>
                            <a
                              href={`tel:${t.phone}`}
                              onClick={e => e.stopPropagation()}
                            >
                              {t.phone}
                            </a>
                            <a
                              href={`https://wa.me/${
                                t.phone
                              }?text=${getTeacherWhatsappMsg(t)}`}
                              onClick={e => e.stopPropagation()}
                            >
                              <img alt="WhatsApp" src="/whatsapp.svg" />
                            </a>
                          </span>
                        </div>
                        {t.joinDate && (
                          <div className="joinDate">{formatJoinDate(t)}</div>
                        )}
                      </div>
                      <div className="leftBottom">
                        <div className="status">
                          {isTeacherAssigned(t)
                            ? 'משובץ'
                            : isTeacherAvailable(t)
                            ? 'זמין'
                            : 'לא זמין'}
                        </div>
                        {!isTeacherAssigned(t) && (
                          <div>
                            {isTeacherFetcherIdle ? (
                              isTeacherAvailable(t) ? (
                                <a
                                  href={'#markAsAvailable'}
                                  onClick={e => assignTeacher(e, t, '')}
                                >
                                  סמן כלא זמין
                                </a>
                              ) : (
                                <a
                                  href={'#markAsUnavailable'}
                                  onClick={e => assignTeacher(e, t, Available)}
                                >
                                  סמן כזמין
                                </a>
                              )
                            ) : (
                              <div>מעדכן...</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={includeAssigned}
                  onChange={() => setIncludeAssigned(v => !v)}
                />
                הצג גם מורים שכבר צוותו
              </label>
            </div>
          )}

          {matchingStudents.length > 0 && (
            <div className="students-section">
              <div className="students-header">
                {isStudentAssigned(matchingStudents[0])
                  ? 'תלמידים שמשובצים ל'
                  : 'תלמידים שרלוונטיים לשיבוץ ל'}
                <span>{selectedTeacher?.name}</span>
              </div>
              <div className="students swipe-list" ref={studentsSwipeRef}>
                {matchingStudents.map(s => (
                  <div key={s.index} className={getStudentClass(s)}>
                    <div className="right">
                      <div className="name">
                        {s.name} <span className="grade">({s.grade})</span>
                      </div>
                      <div className="details">
                        <div>{s.subjects}</div>
                        <div>{s.hours}</div>
                        <div>{s.details}</div>
                        <div>{s.comment}</div>
                      </div>
                    </div>
                    <div className="left">
                      <div className="leftTop">
                        <div className="contact">
                          <span>
                            <a
                              href={`tel:${s.phone}`}
                              onClick={e => e.stopPropagation()}
                            >
                              {s.phone}
                            </a>
                            <a
                              href={`https://wa.me/${
                                s.phone
                              }?text=${getStudentWhatsappMsg(s)}`}
                              onClick={e => e.stopPropagation()}
                            >
                              <img alt="WhatsApp" src="/whatsapp.svg" />
                            </a>
                          </span>
                        </div>
                        {s.joinDate && (
                          <div className="joinDate">{formatJoinDate(s)}</div>
                        )}
                      </div>

                      <div className="leftBottom">
                        {isStudentFetcherIdle ? (
                          <>
                            <div className="status">
                              {isStudentAssigned(s)
                                ? `משובץ ל${s.teacher}`
                                : isStudentAvailable(s)
                                ? 'זמין'
                                : 'לא זמין'}
                            </div>
                            <div>
                              {!isStudentAssigned(s) && (
                                <div>
                                  {isStudentAvailable(s) ? (
                                    <a
                                      href={'#markAsAvailable'}
                                      onClick={e => assignStudent(e, s, '')}
                                    >
                                      סמן כלא זמין
                                    </a>
                                  ) : (
                                    <a
                                      href={'#markAsUnavailable'}
                                      onClick={e =>
                                        assignStudent(e, s, Available)
                                      }
                                    >
                                      סמן כזמין
                                    </a>
                                  )}
                                </div>
                              )}
                              <div>
                                {isStudentAssigned(s) ? (
                                  <a
                                    href={'#unassignStudent'}
                                    onClick={e => assignStudent(e, s, '')}
                                  >
                                    בטל שיבוץ ל{s.teacher}
                                  </a>
                                ) : (
                                  <a
                                    href={'#assignStudent'}
                                    onClick={e =>
                                      assignStudent(e, s, selectedTeacher!.name)
                                    }
                                  >
                                    שבץ ל{selectedTeacher?.name}
                                  </a>
                                )}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div>מעדכן...</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {user && !teachers?.length && (
            <Form method="post" action={`/logout`} className="message warning">
              <h2>
                <div>
                  שלום {user.displayName}, אין מורים שמצוותים אליך במערכת.
                </div>
                <button>יציאה</button>
              </h2>
            </Form>
          )}

          {!user && (
            <Form
              method="post"
              action={`/auth/${SocialsProvider.GOOGLE}`}
              className="message"
            >
              <h2>
                <div>כדי להשתמש במערכת יש להכנס.</div>
                <button>כניסה</button>
              </h2>
            </Form>
          )}
          <ToastContainer
            position="bottom-center"
            autoClose={5000}
            hideProgressBar
            newestOnTop={false}
            closeOnClick
            rtl
            pauseOnFocusLoss
            draggable={false}
            pauseOnHover
            theme="light"
            transition={Zoom}
          />
        </div>
      ) : (
        <h2 className="loader">טוען נתונים...</h2>
      )}
      <div className={`about modal ${isAboutModalOpen ? 'open' : ''}`}>
        <div className="close" onClick={toggleAboutModalOpen}>
          <img alt="Close" src="/close.svg" />
        </div>
        <h2>
          מערכת השיבוץ של מיזם{' '}
          <a href="https://www.learningon.org/">לומדים הלאה</a> נכתבה ב
          <a href="https://github.com/splintor/learning-on">קוד פתוח</a> בידי{' '}
          <a href={`mailto:${ownerEmail}`}>שמוליק פלינט</a>{' '}
          <a
            className="whatsapp"
            href={`https://wa.me/${ownerPhone}?text=שלום שמוליק, זה בקשר למערכת השיבוץ של לומדים הלאה.`}
          >
            <img alt="WhatsApp" src="/whatsapp.svg" height={40} />
          </a>
          .
        </h2>
        {user && (
          <div>
            <h2>
              המצוות הנוכחי הוא
              <br />
              <a href={`mailto:${userEmail}`}>{user.displayName}</a>
            </h2>
            <Form method="post" action={`/logout`}>
              <button onClick={toggleAboutModalOpen}>יציאה</button>
            </Form>
          </div>
        )}
      </div>
      <div
        className={`teachers-list modal ${
          isTeachersListModalOpen ? 'open' : ''
        }`}
      >
        <div className="close" onClick={toggleTeachersListModalOpen}>
          <img alt="Close" src="/close.svg" />
        </div>
        <h4>רשימת מורים</h4>
        <div className="search">
          <input
            type="search"
            placeholder="חיפוש"
            onInput={e =>
              setTeachersSearch((e.target as HTMLInputElement).value)
            }
          />
        </div>
        <div className="list">
          {myTeachers
            .filter(
              t =>
                !teachersSearch ||
                teachersSearch
                  .split(' ')
                  .filter(Boolean)
                  .every(term => t.name.includes(term))
            )
            .map(t => (
              <div
                key={t.index}
                onClick={() => {
                  toggleTeachersListModalOpen();
                  if (isTeacherAssigned(t) && !teachers.includes(t)) {
                    setIncludeAssigned(true);
                  }
                  setSelectedTeacher(t);
                }}
              >
                <div>{t.name}</div>
                <div className="status">
                  {isTeacherAssigned(t)
                    ? 'משובץ'
                    : isTeacherAvailable(t)
                    ? 'זמין'
                    : 'לא זמין'}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
