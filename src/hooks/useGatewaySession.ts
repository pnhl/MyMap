import {useEffect, useState} from 'react';
import {AppState} from 'react-native';
import {onIdTokenChanged} from '@react-native-firebase/auth';
import {firebaseAuth, getFirebaseIdToken} from '../services/firebase';
import {env} from '../config/env';

/** Runtime login token for map renderers that load resources outside fetch(). */
export function useGatewaySession() {
  const [session, setSession] = useState({owner: '', token: ''});
  useEffect(() => {
    let active = true, revision = 0;
    const refresh = async () => {
      const run = ++revision, user = firebaseAuth.currentUser;
      if (!env.routingGatewayUrl || !user || user.isAnonymous) { if (active) setSession({owner: '', token: ''}); return; }
      try {
        const token = await getFirebaseIdToken();
        if (active && run === revision && firebaseAuth.currentUser?.uid === user.uid) setSession({owner: user.uid, token: token || ''});
      } catch { if (active && run === revision) setSession({owner: '', token: ''}); }
    };
    const unsubscribe = onIdTokenChanged(firebaseAuth, user => { setSession(previous => previous.owner === user?.uid ? previous : {owner: '', token: ''}); void refresh(); });
    const appState = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    const timer = setInterval(() => void refresh(), 45 * 60 * 1000);
    void refresh();
    return () => { active = false; revision++; unsubscribe(); appState.remove(); clearInterval(timer); };
  }, []);
  return session;
}
