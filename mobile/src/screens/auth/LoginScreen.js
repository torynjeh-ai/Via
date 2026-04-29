importReact,{useState}from'react';
import{View,Text,StyleSheet,Alert}from'react-native';
importInputfrom'../../components/Input';
importButtonfrom'../../components/Button';
importPhoneInputfrom'../../components/PhoneInput';
importLanguagePickerfrom'../../components/LanguagePicker';
import{login}from'../../api/auth';
import{useAuth}from'../../context/AuthContext';
import{useLanguage}from'../../context/LanguageContext';
import{colors,spacing,fontSize}from'../../theme';

exportdefaultfunctionLoginScreen({navigation}){
const[phone,setPhone]=useState('');
const[password,setPassword]=useState('');
const[loading,setLoading]=useState(false);
const{signIn}=useAuth();
const{t}=useLanguage();

consthandleLogin=async()=>{
if(!phone)returnAlert.alert('Error',t('phoneNumber')+'isrequired');
setLoading(true);
try{
constres=awaitlogin({phone,password});
if(res.data?.token){
awaitsignIn(res.data.token,res.data.user);
}else{
navigation.navigate('VerifyOtp',{phone});
}
}catch(e){
Alert.alert('Error',e.message||'Loginfailed');
}finally{
setLoading(false);
}
};

return(
<Viewstyle={styles.container}>
<Viewstyle={styles.topRow}>
<Textstyle={styles.logo}>💜Via</Text>
<LanguagePickercompact/>
</View>
<Textstyle={styles.title}>{t('welcomeBack')}</Text>
<Textstyle={styles.subtitle}>{t('signInSubtitle')}</Text>

<PhoneInputlabel={t('phoneNumber')}onChangePhone={setPhone}/>
<Inputlabel={t('password')}placeholder="••••••"value={password}onChangeText={setPassword}secureTextEntry/>

<Buttontitle={t('signIn')}onPress={handleLogin}loading={loading}style={styles.btn}/>
<Buttontitle={t('noAccount')+''+t('register')}onPress={()=>navigation.navigate('Register')}variant="outline"/>
</View>
);
}

conststyles=StyleSheet.create({
container:{flex:1,padding:spacing.lg,backgroundColor:colors.background,justifyContent:'center'},
topRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:spacing.md},
logo:{fontSize:fontSize.xl,fontWeight:'700',color:colors.primary},
title:{fontSize:fontSize.xxl,fontWeight:'700',color:colors.text,marginBottom:spacing.xs},
subtitle:{fontSize:fontSize.md,color:colors.subtext,marginBottom:spacing.xl},
btn:{marginBottom:spacing.md},
});
