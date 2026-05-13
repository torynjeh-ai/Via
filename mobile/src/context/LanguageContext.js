import React, { createContext, useContext, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

export const LANGUAGES = [
  { id: 'en', label: 'English',    nativeLabel: 'English',    flag: '🇬🇧' },
  { id: 'fr', label: 'French',     nativeLabel: 'Français',   flag: '🇫🇷' },
  { id: 'es', label: 'Spanish',    nativeLabel: 'Español',    flag: '🇪🇸' },
  { id: 'pt', label: 'Portuguese', nativeLabel: 'Português',  flag: '🇵🇹' },
  { id: 'ar', label: 'Arabic',     nativeLabel: 'العربية',    flag: '🇸🇦' },
  { id: 'sw', label: 'Swahili',    nativeLabel: 'Kiswahili',  flag: '🇰🇪' },
  { id: 'ha', label: 'Hausa',      nativeLabel: 'Hausa',      flag: '🇳🇬' },
  { id: 'yo', label: 'Yoruba',     nativeLabel: 'Yorùbá',     flag: '🇳🇬' },
];

const en = {
  welcomeBack: 'Welcome Back', signInSubtitle: 'Sign in to your Via account',
  phoneNumber: 'Phone Number', password: 'Password', signingIn: 'Signing in...',
  signIn: 'Sign In', noAccount: "Don't have an account?", register: 'Register',
  createAccount: 'Create Account', registerSubtitle: 'Join Via and start saving together',
  fullName: 'Full Name', passwordOptional: 'Password', passwordHint: 'Min 6 characters',
  registering: 'Registering...', alreadyHaveAccount: 'Already have an account?',
  chooseLanguage: 'Choose your language', continueIn: 'Continue in',
  dashboard: 'Dashboard', groups: 'Groups', notifications: 'Notifications',
  profile: 'Profile', settings: 'Settings', trustScore: 'Trust Score',
  myGroups: 'My Njangi Groups', loading: 'Loading...', back: 'Back',
  joinGroup: 'Join Group', contribute: 'Contribute', viewPayouts: 'View Payouts',
  startGroup: 'Start Group', members: 'members', approve: 'Approve',
  editProfile: 'Edit Profile', saveChanges: 'Save Changes', saving: 'Saving...',
  profileUpdated: 'Profile updated', signOut: 'Sign Out',
  cancel: 'Cancel', pay: 'Pay', processing: 'Processing...',
  paymentFailed: 'Payment failed', payoutQueue: 'Payout Queue',
  language: 'Language', languageDesc: 'Choose your preferred language',
};

const fr = {
  welcomeBack: 'Bon retour', signInSubtitle: 'Connectez-vous à votre compte',
  phoneNumber: 'Numéro de téléphone', password: 'Mot de passe', signingIn: 'Connexion...',
  signIn: 'Se connecter', noAccount: "Vous n'avez pas de compte?", register: "S'inscrire",
  createAccount: 'Créer un compte', registerSubtitle: 'Rejoignez Via et épargnez ensemble',
  fullName: 'Nom complet', passwordOptional: 'Mot de passe', passwordHint: 'Min 6 caractères',
  registering: 'Inscription...', alreadyHaveAccount: 'Vous avez déjà un compte?',
  chooseLanguage: 'Choisissez votre langue', continueIn: 'Continuer en',
  dashboard: 'Tableau de bord', groups: 'Groupes', notifications: 'Notifications',
  profile: 'Profil', settings: 'Paramètres', trustScore: 'Score de confiance',
  myGroups: 'Mes groupes Njangi', loading: 'Chargement...', back: 'Retour',
  joinGroup: 'Rejoindre', contribute: 'Contribuer', viewPayouts: 'Voir les paiements',
  startGroup: 'Démarrer le groupe', members: 'membres', approve: 'Approuver',
  editProfile: 'Modifier le profil', saveChanges: 'Enregistrer', saving: 'Enregistrement...',
  profileUpdated: 'Profil mis à jour', signOut: 'Se déconnecter',
  cancel: 'Annuler', pay: 'Payer', processing: 'Traitement...',
  paymentFailed: 'Échec du paiement', payoutQueue: 'File de paiement',
  language: 'Langue', languageDesc: 'Choisissez votre langue préférée',
};

const es = {
  welcomeBack: 'Bienvenido de nuevo', signInSubtitle: 'Inicia sesión en tu cuenta',
  phoneNumber: 'Número de teléfono', password: 'Contraseña', signingIn: 'Iniciando sesión...',
  signIn: 'Iniciar sesión', noAccount: '¿No tienes cuenta?', register: 'Registrarse',
  createAccount: 'Crear cuenta', registerSubtitle: 'Únete a Via y ahorra juntos',
  fullName: 'Nombre completo', passwordOptional: 'Contraseña (opcional)', passwordHint: 'Mín. 6 caracteres',
  registering: 'Registrando...', alreadyHaveAccount: '¿Ya tienes cuenta?',
  chooseLanguage: 'Elige tu idioma', continueIn: 'Continuar en',
  dashboard: 'Panel', groups: 'Grupos', notifications: 'Notificaciones',
  profile: 'Perfil', settings: 'Configuración', trustScore: 'Puntuación de confianza',
  myGroups: 'Mis grupos Njangi', loading: 'Cargando...', back: 'Atrás',
  joinGroup: 'Unirse', contribute: 'Contribuir', viewPayouts: 'Ver pagos',
  startGroup: 'Iniciar grupo', members: 'miembros', approve: 'Aprobar',
  editProfile: 'Editar perfil', saveChanges: 'Guardar', saving: 'Guardando...',
  profileUpdated: 'Perfil actualizado', signOut: 'Cerrar sesión',
  cancel: 'Cancelar', pay: 'Pagar', processing: 'Procesando...',
  paymentFailed: 'Pago fallido', payoutQueue: 'Cola de pagos',
  language: 'Idioma', languageDesc: 'Elige tu idioma preferido',
};

const pt = {
  welcomeBack: 'Bem-vindo de volta', signInSubtitle: 'Entre na sua conta',
  phoneNumber: 'Número de telefone', password: 'Senha', signingIn: 'Entrando...',
  signIn: 'Entrar', noAccount: 'Não tem conta?', register: 'Registrar',
  createAccount: 'Criar conta', registerSubtitle: 'Junte-se ao Via e economize juntos',
  fullName: 'Nome completo', passwordOptional: 'Senha', passwordHint: 'Mín. 6 caracteres',
  registering: 'Registrando...', alreadyHaveAccount: 'Já tem conta?',
  chooseLanguage: 'Escolha seu idioma', continueIn: 'Continuar em',
  dashboard: 'Painel', groups: 'Grupos', notifications: 'Notificações',
  profile: 'Perfil', settings: 'Configurações', trustScore: 'Pontuação de confiança',
  myGroups: 'Meus grupos Njangi', loading: 'Carregando...', back: 'Voltar',
  joinGroup: 'Entrar', contribute: 'Contribuir', viewPayouts: 'Ver pagamentos',
  startGroup: 'Iniciar grupo', members: 'membros', approve: 'Aprovar',
  editProfile: 'Editar perfil', saveChanges: 'Salvar', saving: 'Salvando...',
  profileUpdated: 'Perfil atualizado', signOut: 'Sair',
  cancel: 'Cancelar', pay: 'Pagar', processing: 'Processando...',
  paymentFailed: 'Pagamento falhou', payoutQueue: 'Fila de pagamentos',
  language: 'Idioma', languageDesc: 'Escolha seu idioma preferido',
};

const ar = {
  welcomeBack: 'مرحباً بعودتك', signInSubtitle: 'سجّل الدخول إلى حسابك',
  phoneNumber: 'رقم الهاتف', password: 'كلمة المرور', signingIn: 'جار تسجيل الدخول...',
  signIn: 'تسجيل الدخول', noAccount: 'ليس لديك حساب؟', register: 'تسجيل',
  createAccount: 'إنشاء حساب', registerSubtitle: 'انضم إلى Via وادخر معاً',
  fullName: 'الاسم الكامل', passwordOptional: 'كلمة المرور (اختياري)', passwordHint: '٦ أحرف على الأقل',
  registering: 'جار التسجيل...', alreadyHaveAccount: 'لديك حساب بالفعل؟',
  chooseLanguage: 'اختر لغتك', continueIn: 'المتابعة بـ',
  dashboard: 'لوحة التحكم', groups: 'المجموعات', notifications: 'الإشعارات',
  profile: 'الملف الشخصي', settings: 'الإعدادات', trustScore: 'درجة الثقة',
  myGroups: 'مجموعاتي', loading: 'جار التحميل...', back: 'رجوع',
  signOut: 'تسجيل الخروج', cancel: 'إلغاء', pay: 'ادفع',
  language: 'اللغة', languageDesc: 'اختر لغتك المفضلة',
};

const sw = {
  welcomeBack: 'Karibu Tena', signInSubtitle: 'Ingia kwenye akaunti yako',
  phoneNumber: 'Nambari ya Simu', password: 'Nenosiri', signingIn: 'Inaingia...',
  signIn: 'Ingia', noAccount: 'Huna akaunti?', register: 'Jisajili',
  createAccount: 'Fungua Akaunti', registerSubtitle: 'Jiunge na Via na uokoe pamoja',
  fullName: 'Jina Kamili', passwordOptional: 'Nenosiri', passwordHint: 'Herufi 6 au zaidi',
  registering: 'Inasajili...', alreadyHaveAccount: 'Una akaunti tayari?',
  chooseLanguage: 'Chagua lugha yako', continueIn: 'Endelea kwa',
  dashboard: 'Dashibodi', groups: 'Vikundi', notifications: 'Arifa',
  profile: 'Wasifu', settings: 'Mipangilio', trustScore: 'Alama ya Uaminifu',
  myGroups: 'Vikundi Vyangu', loading: 'Inapakia...', back: 'Rudi',
  signOut: 'Toka', cancel: 'Ghairi', pay: 'Lipa',
  language: 'Lugha', languageDesc: 'Chagua lugha unayopendelea',
};

const ha = {
  welcomeBack: 'Barka da Dawowar', signInSubtitle: 'Shiga asusunka',
  phoneNumber: 'Lambar Waya', password: 'Kalmar Sirri', signingIn: 'Ana shiga...',
  signIn: 'Shiga', noAccount: 'Ba ka da asusu?', register: 'Yi rajista',
  createAccount: 'Ƙirƙiri Asusu', registerSubtitle: 'Shiga Via ka ajiye tare',
  fullName: 'Cikakken Suna', passwordOptional: 'Kalmar Sirri (zaɓi)', passwordHint: 'Haruffa 6 ko fiye',
  registering: 'Ana rajista...', alreadyHaveAccount: 'Kana da asusu?',
  chooseLanguage: 'Zaɓi harshenka', continueIn: 'Ci gaba da',
  dashboard: 'Allon Sarrafa', groups: 'Ƙungiyoyi', notifications: 'Sanarwa',
  profile: 'Bayanan Kai', settings: 'Saituna', trustScore: 'Maki na Amana',
  myGroups: 'Ƙungiyoyina', loading: 'Ana lodi...', back: 'Koma',
  signOut: 'Fita', cancel: 'Soke', pay: 'Biya',
  language: 'Harshe', languageDesc: 'Zaɓi harshen da kake so',
};

const yo = {
  welcomeBack: 'Ẹ káàbọ̀ padà', signInSubtitle: 'Wọlé sí àkáǹtì rẹ',
  phoneNumber: 'Nọ́mbà Fóònù', password: 'Ọ̀rọ̀ Aṣínà', signingIn: 'Ń wọlé...',
  signIn: 'Wọlé', noAccount: 'Kò sí àkáǹtì?', register: 'Forúkọsílẹ̀',
  createAccount: 'Ṣẹ̀dá Àkáǹtì', registerSubtitle: 'Darapọ̀ mọ́ Via kí ẹ pamọ́ papọ̀',
  fullName: 'Orúkọ Kíkún', passwordOptional: 'Ọ̀rọ̀ Aṣínà (àṣàyàn)', passwordHint: 'Ìwé 6 tàbí jù bẹ́ẹ̀ lọ',
  registering: 'Ń forúkọsílẹ̀...', alreadyHaveAccount: 'Ó ti ní àkáǹtì?',
  chooseLanguage: 'Yan èdè rẹ', continueIn: 'Tẹ̀síwájú ní',
  dashboard: 'Pẹpẹ Iṣakoso', groups: 'Àwọn Ẹgbẹ', notifications: 'Ìwífún',
  profile: 'Profaili', settings: 'Ètò', trustScore: 'Ìdánilójú Ìgbẹ́kẹ̀lé',
  myGroups: 'Àwọn Ẹgbẹ Mi', loading: 'Ń gbé...', back: 'Padà',
  signOut: 'Jáde', cancel: 'Fagilé', pay: 'San',
  language: 'Èdè', languageDesc: 'Yan èdè tí o fẹ́',
};

const dicts = { en, fr, es, pt, ar, sw, ha, yo };

const LanguageContext = createContext({});

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('en');

  // Load saved language on mount
  React.useEffect(() => {
    SecureStore.getItemAsync('lang').then(saved => { if (saved) setLang(saved); });
  }, []);

  const t = (key) => {
    const dict = dicts[lang] || en;
    return dict[key] || en[key] || key;
  };

  const setLanguage = async (l) => {
    setLang(l);
    await SecureStore.setItemAsync('lang', l);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
