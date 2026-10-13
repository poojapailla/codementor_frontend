import { useEffect, useState } from 'react'

import './App.css'



const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'



const DEFAULT_CODE = {

  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println(10 / 0);\n    }\n}',

  python: 'numbers = [1, 2, 3]\nprint(numbers[5])',

  javascript: 'const user = null;\nconsole.log(user.name);',

  cpp: '#include <iostream>\nusing namespace std;\nint main() {\n    int x = 10 / 0;\n    cout << x;\n    return 0;\n}',

  c: '#include <stdio.h>\nint main(void) {\n    int x = 10 / 0;\n    printf("%d", x);\n    return 0;\n}',

}



function App() {

  const [mode, setMode] = useState('review')

  const [user, setUser] = useState(null)

  const [token, setToken] = useState('')

  const [authMode, setAuthMode] = useState('login')

  const [name, setName] = useState('')

  const [email, setEmail] = useState('')

  const [password, setPassword] = useState('')

  const [title, setTitle] = useState('My code review')

  const [language, setLanguage] = useState('java')

  const [skillLevel, setSkillLevel] = useState('beginner')

  const [question, setQuestion] = useState('Explain this code step by step.')

  const [code, setCode] = useState(DEFAULT_CODE.java)

  const [tutorResult, setTutorResult] = useState(null)

  const [reviewResult, setReviewResult] = useState(null)

  const [complexityResult, setComplexityResult] = useState(null)

  const [loading, setLoading] = useState(false)

  const [error, setError] = useState('')

  const [notice, setNotice] = useState('')
  const [historyItems, setHistoryItems] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [expandedHistoryId, setExpandedHistoryId] = useState(null)
  const [testResult, setTestResult] = useState(null)



  function clearMessages() {

    setError('')

    setNotice('')

  }

  function clearAuthentication() {

    localStorage.removeItem('codementorUser')

    localStorage.removeItem('codementorToken')

    setUser(null)

    setToken('')

    setTutorResult(null)

    setReviewResult(null)

    setComplexityResult(null)

    setTestResult(null)

    setHistoryItems([])

    setExpandedHistoryId(null)

    setHistoryError('')

  }



  function changeLanguage(nextLanguage) {

    const previousDefault = DEFAULT_CODE[language] || ''



    // Only swap in the sample program when the user has not edited it,

    // so pasted code is never silently overwritten.

    if (!code.trim() || code === previousDefault) {

      setCode(DEFAULT_CODE[nextLanguage] || '')

    }

    setLanguage(nextLanguage)

    setTutorResult(null)

    setReviewResult(null)

    setTestResult(null)

    clearMessages()

  }



  async function readResponse(response) {

    const text = await response.text()

    let data



    try {

      data = text ? JSON.parse(text) : {}

    } catch {

      data = { message: text }

    }



    if (!response.ok) {

      throw new Error(

        data.message || data.error || data.detail || `Request failed (${response.status})`,

      )

    }



    return data

  }



  function authHeaders() {

    return token ? { 'Authorization': `Bearer ${token}` } : {}

  }



  async function authFetch(url, options = {}) {

    const response = await fetch(url, {

      ...options,

      headers: {

        'Content-Type': 'application/json',

        ...authHeaders(),

        ...(options.headers || {}),

      },

    })



    if (response.status === 401 && token) {

      clearAuthentication()

    }



    return response

  }



  async function submitAuth(event) {

    event.preventDefault()

    setLoading(true)

    clearMessages()



    try {

      const endpoint = authMode === 'login' ? '/api/users/login' : '/api/users/register'

      const payload = authMode === 'login'

        ? { email, password }

        : { name, email, password }



      const response = await fetch(`${API_URL}${endpoint}`, {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(payload),

      })



      const data = await readResponse(response)



      if (authMode === 'register') {

        setNotice('Registration successful. Please log in with your new account.')

        setAuthMode('login')

        setPassword('')

        return

      }



      if (!data.token) {

        throw new Error('Login succeeded but the server did not return an authentication token.')

      }

      if (data.id == null) {

        throw new Error('Login succeeded but the server did not return a user ID.')

      }

      localStorage.removeItem('codementorUser')

      localStorage.setItem('codementorToken', data.token)

      setToken(data.token)



      const loggedInUser = {

        id: data.id,

        name: data.name || email,

        email: data.email || email,

        role: data.role || 'USER',

      }



      setUser(loggedInUser)

      setPassword('')

      setNotice(`Welcome, ${loggedInUser.name}!`)

    } catch (err) {

      setError(`${err.message}. Check that Spring Boot is running on port 8080.`)

    } finally {

      setLoading(false)

    }

  }



  function logout() {

    clearAuthentication()

    setPassword('')

    clearMessages()

  }



  async function teachCode(event) {

    event.preventDefault()

    setLoading(true)

    setError('')

    setNotice('')

    setTutorResult(null)



    try {

      const response = await authFetch(`${API_URL}/api/tutor/teach`, {

        method: 'POST',

        body: JSON.stringify({ code, language, skillLevel, question }),

      })



      setTutorResult(await readResponse(response))

    } catch (err) {

      setError(`${err.message}. Check that Spring Boot is running on port 8080 and the Python AI service is running on port 8000.`)

    } finally {

      setLoading(false)

    }

  }



  async function generateTests(event) {

    event.preventDefault()

    setLoading(true)

    setError('')

    setNotice('')

    setTestResult(null)



    try {

      const response = await authFetch(`${API_URL}/api/test-cases/generate`, {

        method: 'POST',

        body: JSON.stringify({ code, language, problemDescription: question.trim() || undefined }),

      })

      setTestResult(await readResponse(response))

    } catch (err) {

      setError(`${err.message}. Check that Spring Boot is running on port 8080 and the Python AI service is running on port 8000.`)

    } finally {

      setLoading(false)

    }

  }



  async function reviewCode(event) {

    event.preventDefault()



    if (!token) {

      setError('Please log in again so we can identify your account.')

      return

    }



    setLoading(true)

    setError('')

    setNotice('')

    setReviewResult(null)



    try {

      const submissionResponse = await authFetch(`${API_URL}/api/code-submissions`, {

        method: 'POST',

        body: JSON.stringify({

          title: title.trim() || 'Code review',

          language,

          code,

          problemDescription: question.trim() || 'Review this code for bugs and improvements.',

        }),

      })



      const submission = await readResponse(submissionResponse)



      if (submission.id == null) {

        throw new Error('The server saved the submission but did not return its ID.')

      }



      const reviewResponse = await authFetch(`${API_URL}/api/code-reviews`, {

        method: 'POST',

        body: JSON.stringify({ submissionId: submission.id }),

      })



      const review = await readResponse(reviewResponse)

      setReviewResult(review)

      setNotice(`Review completed for submission #${submission.id}.`)

    } catch (err) {

      setError(`${err.message}. Check that Spring Boot is running on port 8080 and the Python AI service is running on port 8000. If the review failed after saving the submission, submit the code again as a new review.`)

    } finally {

      setLoading(false)

    }

  }



  async function analyzeComplexity(event) {

    event.preventDefault()

    setLoading(true)

    setError('')

    setNotice('')

    setComplexityResult(null)



    try {

      const response = await authFetch(`${API_URL}/api/complexity/analyze`, {

        method: 'POST',

        body: JSON.stringify({ code, language }),

      })

      setComplexityResult(await readResponse(response))

    } catch (err) {

      setError(`${err.message}. Check that Spring Boot is running on port 8080.`)

    } finally {

      setLoading(false)

    }

  }



  async function loadHistory() {
    if (!token) {
      setHistoryError('Please log in again to view your review history.')
      return
    }
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const response = await authFetch(`${API_URL}/api/code-submissions/me`)
      const data = await readResponse(response)
      setHistoryItems(Array.isArray(data) ? data : (data.content || data.submissions || []))
    } catch (err) {
      setHistoryError(`${err.message}. Check that Spring Boot is running on port 8080.`)
    } finally {
      setHistoryLoading(false)
    }
  }

  function changeMode(nextMode) {

    setMode(nextMode)

    setError('')

    setNotice('')

    setTutorResult(null)

    setReviewResult(null)

    setComplexityResult(null)

    setTestResult(null)

  }



  useEffect(() => {

    let cancelled = false

    async function validateSession() {

      const storedToken = localStorage.getItem('codementorToken')

      if (!storedToken) {

        localStorage.removeItem('codementorUser')

        return

      }

      try {

        const response = await fetch(`${API_URL}/api/users/me`, {

          headers: { 'Authorization': `Bearer ${storedToken}` },

        })

        if (cancelled) return

        if (response.ok) {

          const me = await response.json()

          if (cancelled) return

          if (me?.id == null) {

            throw new Error('The server returned an invalid user profile.')

          }

          setToken(storedToken)

          setUser(me)

        } else {

          clearAuthentication()

        }

      } catch {

        if (cancelled) return

        setError('Unable to verify the saved session. Please log in again.')

      }

    }



    validateSession()

    return () => { cancelled = true }

  }, [])



  return (

    <main className="app-shell">

      <header className="topbar">

        <a className="brand" href="#home">

          <span className="brand-mark">C</span>

          <span>CodeMentor <strong>AI</strong></span>

        </a>

        <div className="header-actions">

          <span className="status"><span className="status-dot" /> Local AI workspace</span>

          {user && (

            <button className="logout-button" type="button" onClick={logout}>

              Log out

            </button>

          )}

        </div>

      </header>



      <section className="intro" id="home">

        <span className="eyebrow">YOUR PERSONAL AI CODING WORKSPACE</span>

        <h1>Understand code.<br /><span>Become a better developer.</span></h1>

        <p>Review code, learn concepts step by step, and improve your programming skills with your local AI model.</p>

      </section>



      {!user ? (

        <section className="auth-wrap">

          <form className="panel editor-panel auth-panel" onSubmit={submitAuth}>

            <div className="panel-heading">

              <div>

                <span className="panel-kicker">YOUR ACCOUNT</span>

                <h2>{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h2>

              </div>

              <span className="ai-badge">{authMode === 'login' ? 'LOGIN' : 'REGISTER'}</span>

            </div>



            {authMode === 'register' && (

              <>

                <label htmlFor="name">Full name</label>

                <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" required />

              </>

            )}



            <label htmlFor="email">Email address</label>

            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />



            <label htmlFor="password">Password</label>

            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete={authMode === 'login' ? 'current-password' :'new-password'} required />



            {error && <div className="error-box"><strong>Couldn't authenticate</strong><p>{error}</p></div>}

            {notice && <div className="notice-box">{notice}</div>}



            <button className="primary-button" type="submit" disabled={loading}>

              {loading ? 'Please wait...' : authMode === 'login' ? 'Log in to CodeMentor AI' : 'Create account'}

            </button>



            <p className="auth-switch">

              {authMode === 'login' ? "Don't have an account?" : 'Already registered?'}{' '}

              <button type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); clearMessages() }}>

                {authMode === 'login' ? 'Register' : 'Log in'}

              </button>

            </p>

            <p className="privacy-note">Your password is sent to your local backend over the configured development connection. Never share your password.</p>

          </form>

        </section>

      ) : (

        <>

          <div className="welcome-row">

            <div>

              <span className="panel-kicker">SIGNED IN</span>

              <h2>Welcome, {user.name}</h2>

              <p>{user.email} · Choose a workspace to get started.</p>

            </div>

            <span className="user-chip">USER #{user.id}</span>

          </div>



          <nav className="mode-tabs" aria-label="Coding tools">

            <button type="button" className={mode === 'review' ? 'mode-tab active' : 'mode-tab'} onClick={() => changeMode('review')}>

              <span>01</span> AI Code Review

            </button>

            <button type="button" className={mode === 'tutor' ? 'mode-tab active' : 'mode-tab'} onClick={() => changeMode('tutor')}>

              <span>02</span> AI Tutor Mode

            </button>

            <button type="button" className={mode === 'complexity' ? 'mode-tab active' : 'mode-tab'} onClick={() => changeMode('complexity')}>

              <span>03</span> Complexity Analysis

            </button>            <button type="button" className={mode === 'tests' ? 'mode-tab active' : 'mode-tab'} onClick={() => changeMode('tests')}>

              <span>04</span> Test Case Generator

            </button>

            <button type="button" className={mode === 'history' ? 'mode-tab active' : 'mode-tab'} onClick={() => { changeMode('history'); loadHistory() }}>

              <span>05</span> Review History

            </button>

          </nav>



          {mode === 'history' ? (
            <section className="panel results-panel history-panel">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">SAVED SUBMISSIONS</span>
                  <h2>Your review history</h2>
                </div>
                <button className="secondary-button" type="button" onClick={loadHistory} disabled={historyLoading}>
                  {historyLoading ? 'Refreshing...' : 'Refresh history'}
                </button>
              </div>
              {historyError && <div className="error-box"><strong>Could not load history</strong><p>{historyError}</p></div>}
              {historyLoading && <div className="loading-state"><p>Loading your saved submissions...</p></div>}
              {!historyLoading && !historyError && historyItems.length === 0 && (
                <div className="empty-state">
                  <h3>No submissions yet</h3>
                  <p>Your code submissions will appear here after you use AI Code Review.</p>
                  <button className="secondary-button" type="button" onClick={() => changeMode('review')}>Review some code</button>
                </div>
              )}
              {!historyLoading && historyItems.length > 0 && (
                <div className="history-list">
                  {historyItems.map((item) => (
                    <article className="answer-card history-item" key={item.id}>
                      <div className="panel-heading">
                        <div>
                          <h3>{item.title || `Submission #${item.id}`}</h3>
                          <p>{(item.language || 'Unknown language').toUpperCase()} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Date unavailable'}</p>
                        </div>
                        <button className="secondary-button" type="button" onClick={() => setExpandedHistoryId(expandedHistoryId === item.id ? null : item.id)}>
                          {expandedHistoryId === item.id ? 'Hide code' : 'View code'}
                        </button>
                      </div>
                      {item.problemDescription && <p>{item.problemDescription}</p>}
                      {expandedHistoryId === item.id && <pre><code>{item.code || 'No code was saved for this submission.'}</code></pre>}
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : (
          <section className="workspace">

            <form className="panel editor-panel" onSubmit={mode === 'review' ? reviewCode : mode === 'tutor' ? teachCode : mode === 'tests' ? generateTests : analyzeComplexity}>

              <div className="panel-heading">

                <div>

                  <span className="panel-kicker">01 / INPUT</span>

                  <h2>{mode === 'review' ? 'Review my code' : mode === 'tutor' ? 'Teach me this code' : mode === 'tests' ? 'Generate test cases' : 'Analyze complexity'}</h2>

                </div>

                <span className="language-badge">CODE EDITOR</span>

              </div>



              {mode === 'review' && (

                <>

                  <label htmlFor="title">Submission title</label>

                  <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Array problem review" required />

                </>

              )}



              <label htmlFor="language">Programming language</label>

              <select id="language" value={language} onChange={(e) => changeLanguage(e.target.value)}>

                <option value="java">Java</option>

                <option value="python">Python</option>

                <option value="javascript">JavaScript</option>

                <option value="cpp">C++</option>

                <option value="c">C</option>

              </select>



              {mode === 'tutor' && (

                <>

                  <label htmlFor="skillLevel">Your current level</label>

                  <select id="skillLevel" value={skillLevel} onChange={(e) => setSkillLevel(e.target.value)}>

                    <option value="beginner">Beginner</option>

                    <option value="intermediate">Intermediate</option>

                    <option value="advanced">Advanced</option>

                  </select>

                </>

              )}



              <label htmlFor="code">Your code</label>

              <textarea id="code" className="code-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste your code here..." required spellCheck="false" />



              <label htmlFor="question">{mode === 'review'

                ? 'Problem description (optional)'                  : mode === 'tutor'

                  ? 'What would you like to learn?'

                  : mode === 'tests'

                    ? 'What should the code accomplish? (optional)'

                    : 'Complexity analysis notes (optional)'}</label>

              <textarea

                id="question"

                className="question-input"

                value={question}

                onChange={(e) => setQuestion(e.target.value)}

                placeholder={mode === 'review'

                  ? 'Describe what the code should do or what to check...'

                  : mode === 'tutor'

                    ? 'Explain this code step by step...'

                    : 'Optional notes about the algorithm or input size...'}

                required={mode === 'tutor'}

                rows={3}

              />



              <button className="primary-button" type="submit" disabled={loading || !code.trim()}>

                {loading

                  ? <><span className="spinner" /> {mode === 'review' ? 'Reviewing your code...' : mode === 'tutor' ? 'Your tutor is thinking...' : mode === 'tests' ? 'Generating test cases...' : 'Analyzing complexity...'}</>

                  : mode === 'review' ? '✦  Review my code' : mode === 'tutor' ? 'Explain my code' : mode === 'tests' ? 'Generate test cases' : 'Analyze complexity'}

              </button>

              <p className="privacy-note">Code is processed by your locally running CodeMentor AI services.</p>

            </form>



            <section className="panel results-panel" aria-live="polite">

              <div className="panel-heading">

                <div>

                  <span className="panel-kicker">02 / RESULTS</span>

                  <h2>{mode === 'review' ? 'Your code review' : mode === 'tutor' ? "Your tutor's response" : mode === 'tests' ? 'Your generated test cases' : 'Complexity results'}</h2>

                </div>

                <span className="ai-badge">{mode === 'review' ? 'AI REVIEW' : mode === 'tutor' ? 'AI TUTOR' : mode === 'tests' ? 'TEST CASES' : 'COMPLEXITY'}</span>

              </div>



              {error && <div className="error-box"><strong>Something went wrong</strong><p>{error}</p></div>}

              {notice && <div className="notice-box">{notice}</div>}



              {loading && (

                <div className="loading-state">

                  <div className="loader-orbit"><span /></div>

                  <h3>{mode === 'review' ? 'Reviewing your code' : mode === 'tutor' ? 'Thinking through your code' : mode === 'tests' ? 'Generating test cases' : 'Analyzing complexity'}</h3>

                  <p>Your local AI model is preparing a response. This may take a little while.</p>

                </div>

              )}



              {!loading && !error && !notice && !tutorResult && !reviewResult && !complexityResult && !testResult &&(

                <div className="empty-state">

                  <div className="empty-icon">✳</div>

                  <h3>{mode === 'review' ? 'Ready for a code review?' : mode === 'tests' ? 'Ready to generate test cases?' : 'Your learning session starts here'}</h3>

                  <p>{mode === 'review' ? 'Submit your code to find potential bugs, get suggestions, and see an improved version.' : mode === 'tutor' ? 'Submit code to receive an explanation, a guided breakdown, an example, and a practice tip.' : mode === 'tests' ? 'Submit code to receive 3 to 5 suggested test cases with inputs, expected outputs, and explanations.' : 'Submit code to estimate its time and space complexity.'}</p>

                  <div className="feature-list">

                    {mode === 'review' ? (

                      <>

                        <span>→ Bug analysis</span>

                        <span>→ Optimization suggestions</span>

                        <span>→ Quality score</span>

                      </>

                    ) : mode === 'tests' ? (

                      <>

                        <span>→ Normal and edge cases</span>

                        <span>→ Expected outputs</span>

                        <span>→ Clear explanations</span>

                      </>

                    ) : (

                      <>

                        <span>→ Understand errors</span>

                        <span>→ Learn at your level</span>

                        <span>→ Practice better coding</span>

                      </>

                    )}

                  </div>

                </div>

              )}



              {!loading && mode === 'review' && reviewResult && (

                <div className="response-content">

                  <div className="score-card">

                    <span className="score-label">CODE QUALITY SCORE</span>

                    <strong>{(reviewResult.qualityScore ?? reviewResult.quality_score) ?? '—'}<small>{(reviewResult.qualityScore ?? reviewResult.quality_score) == null ? '' : '/100'}</small></strong>

                  </div>

                  <article className="answer-card">

                    <h3><span>01</span> Bug analysis</h3>

                    <p>{(reviewResult.bugAnalysis || reviewResult.bug_analysis) || 'No bug analysis was returned.'}</p>

                  </article>

                  <article className="answer-card">

                    <h3><span>02</span> Explanation</h3>

                    <p>{reviewResult.explanation || 'No explanation was returned.'}</p>

                  </article>

                  <article className="answer-card">

                    <h3><span>03</span> Suggestions</h3>

                    <p>{reviewResult.suggestions || 'No suggestions were returned.'}</p>

                  </article>

                  <article className="answer-card">

                    <h3><span>04</span> Optimized code</h3>

                    <pre><code>{reviewResult.optimizedCode || 'No optimized code was returned.'}</code></pre>

                    <button className="secondary-button copy-button" type="button" onClick={() => navigator.clipboard.writeText(reviewResult.optimizedCode || '').then(() => setNotice('Optimized code copied.')).catch(() => setError('Could not copy automatically. Select and copy the code manually.'))}>Copy optimized code</button>

                  </article>

                  <button className="secondary-button" type="button" onClick={() => { setReviewResult(null); clearMessages() }}>Start another review</button>

                </div>

              )}



              {!loading && mode === 'complexity' && complexityResult && (

                <div className="response-content">

                  <article className="answer-card">

                    <h3><span>01</span> Time complexity</h3>

                    <p>{complexityResult.timeComplexity || 'Not available'}</p>

                  </article>

                  <article className="answer-card">

                    <h3><span>02</span> Space complexity</h3>

                    <p>{complexityResult.spaceComplexity || 'Not available'}</p>

                  </article>

                  <article className="answer-card">

                    <h3><span>03</span> Explanation</h3>

                    <p>{complexityResult.explanation || 'No explanation was returned.'}</p>

                  </article>

                  <button className="secondary-button" type="button" onClick={() => { setComplexityResult(null); clearMessages() }}>Analyze another program</button>

                </div>

              )}



              {!loading && mode === 'tests' && testResult && (

                <div className="response-content">

                  {Array.isArray(testResult.testCases) && testResult.testCases.map((tc, index) => (

                    <article className="answer-card" key={tc.name || index}>

                      <h3><span>{String(index + 1).padStart(2, '0')}</span> {tc.name || `Test case ${index + 1}`}</h3>

                      <p><strong>Category:</strong> {tc.type || 'Not provided'}</p>

                      <p><strong>Input:</strong></p>

                      <pre><code>{tc.input || 'Not provided'}</code></pre>

                      <p><strong>Expected output:</strong></p>

                      <pre><code>{tc.expectedOutput || 'Not provided'}</code></pre>

                      <p>{tc.explanation || ''}</p>

                    </article>

                  ))}

                  {testResult.notes && <p className="privacy-note">{testResult.notes}</p>}

                  <p className="privacy-note">These test cases are AI-generated suggestions based on reading the code. They have not been executed.</p>

                  <button className="secondary-button" type="button" onClick={() => { setTestResult(null); clearMessages() }}>Generate more test cases</button>

                </div>

              )}



              {!loading && mode === 'tutor' && tutorResult && (

                <div className="response-content">

                  <article className="answer-card">

                    <h3><span>01</span> Explanation</h3>

                    <p>{tutorResult.explanation || 'No explanation was returned.'}</p>

                  </article>

                  <article className="answer-card">

                    <h3><span>02</span> Step-by-step guide</h3>

                    <p>{tutorResult.stepByStepGuide || 'No step-by-step guide was returned.'}</p>

                  </article>

                  <article className="answer-card">

                    <h3><span>03</span> Example</h3>

                    <pre><code>{tutorResult.example || 'No example was returned.'}</code></pre>

                  </article>

                  <article className="answer-card practice-card">

                    <h3><span>04</span> Practice tip</h3>

                    <p>{tutorResult.practiceTip || 'No practice tip was returned.'}</p>

                  </article>

                  <button className="secondary-button" type="button" onClick={() => { setTutorResult(null); clearMessages() }}>Start another session</button>

                </div>

              )}

            </section>

          </section>
          )}

        </>

      )}



      <footer className="footer">

        <span>CodeMentor AI</span>

        <span>Learn the logic. Write with confidence.</span>

      </footer>

    </main>

  )

}



export default App



