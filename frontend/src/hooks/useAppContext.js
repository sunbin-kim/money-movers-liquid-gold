import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AppContext = createContext(null);

// Default weekly amount used when a user skips the budget page (quiz-first flow)
export const DEFAULT_WEEKLY_AMOUNT = '25';

export function AppProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem('lg_theme') || 'dark'
  );

  // Tutorial: show automatically the first time a user ever uses the app
  const [tutorialOpen, setTutorialOpen] = useState(false);

  function openTutorial()  { setTutorialOpen(true);  }
  function closeTutorial() { setTutorialOpen(false); }

  function setTheme(t) {
    setThemeState(t);
    localStorage.setItem('lg_theme', t);
  }

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  const [budget, setBudget] = useState({ weeklyAmount: DEFAULT_WEEKLY_AMOUNT, income: '' });
  const [riskProfile, setRiskProfile] = useState(null); // 'conservative'|'balanced'|'aggressive'
  const [holdPeriodMonths, setHoldPeriodMonths] = useState(6);
  const [frequency, setFrequency] = useState('weekly'); // 'one-time'|'daily'|'weekly'|'monthly'|'yearly'
  const [activePortfolioId, setActivePortfolioId] = useState(null); // portfolio that drove recommendations
  const [reinvestAmount, setReinvestAmount] = useState(null); // cash balance being reinvested, or null
  const [recommendations, setRecommendations] = useState(null);
  const [confirmed, setConfirmed] = useState(null); // the chosen option
  // surveyDone: null = unknown, false = not done, true = done
  const [surveyDone, setSurveyDone] = useState(null);

  // On mount, hydrate riskProfile + holdPeriodMonths from the saved survey so
  // returning users never see a blank risk profile after page refresh.
  // Only runs when a token is already present in storage (i.e. the user was
  // previously logged in and their session persisted).
  useEffect(() => {
    const token = localStorage.getItem('lg_auth_token');
    if (!token) {
      // No session — leave surveyDone as null; SurveyGatePage will check
      // after login sets the token and calls resetAppForNewSession().
      return;
    }
    api.getSurvey()
      .then((res) => {
        const survey = res.data?.survey;
        if (survey) {
          setRiskProfile(survey.riskProfile);
          setHoldPeriodMonths(survey.holdPeriodMonths);
          setSurveyDone(true);
        } else {
          setSurveyDone(false);
        }
      })
      .catch(() => setSurveyDone(false));
  }, []); // run once on mount

  // Call this right after login so the survey gate re-checks from the backend
  // instead of relying on potentially stale in-memory state from a previous
  // (logged-out) session.
  function resetAppForNewSession() {
    setSurveyDone(null);
    setRiskProfile(null);
    setRecommendations(null);
    setConfirmed(null);
    setBudget({ weeklyAmount: DEFAULT_WEEKLY_AMOUNT, income: '' });
    setHoldPeriodMonths(6);
    setFrequency('weekly');
    setActivePortfolioId(null);
    setReinvestAmount(null);

    // Show tutorial on first-ever login (flag stored in localStorage)
    if (!localStorage.getItem('lg_tutorial_seen')) {
      setTutorialOpen(true);
      localStorage.setItem('lg_tutorial_seen', '1');
    }
  }

  return (
    <AppContext.Provider
      value={{
        theme, setTheme, toggleTheme,
        tutorialOpen, openTutorial, closeTutorial,
        budget, setBudget,
        riskProfile, setRiskProfile,
        holdPeriodMonths, setHoldPeriodMonths,
        frequency, setFrequency,
        activePortfolioId, setActivePortfolioId,
        reinvestAmount, setReinvestAmount,
        recommendations, setRecommendations,
        confirmed, setConfirmed,
        surveyDone, setSurveyDone,
        resetAppForNewSession,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
