importReact,{useState}from'react';
import{View,Text,StyleSheet,ScrollView,Alert}from'react-native';
importInputfrom'../../components/Input';
importButtonfrom'../../components/Button';
importPhoneInputfrom'../../components/PhoneInput';
importLanguagePickerfrom'../../components/LanguagePicker';
import{register}from'../../api/auth';
import{useLanguage}from'../../context/LanguageContext';
import{colors,spacing,fontSize}from'../../theme';

exportdefaultfunctionRegisterScreen({navigation}){
const[name,setName]=useState('');
const[phone,setPhone]=useState('');
const[password,setPassword]=useState('');
const[loading,setLoading]=useState(false);
const{t}=useLanguage();

consthandleRegister=async()=>{
if(!name||!phone)returnAlert.alert('Error',t('fullName')+'and'+t('phoneNumber')+'arerequired');
setLoading(true);
try{
awaitregister({name,phone,password});
navigation.navigate('VerifyOtp',{phone});
}catch(e){
Alert.alert('Error',e.message||'Registrationfailed');
}finally{
setLoading(false);
}
};

return(
<ScrollViewcontentContainerStyle={styles.container}keyboardShouldPersistTaps="handled">
<Viewstyle={styles.topRow}>
<Textstyle={styles.logo}>💜Via</Text>
<LanguagePickercompact/>
</View>
<Textstyle={styles.title}>{t('createAccount')}</Text>
<Textstyle={styles.subtitle}>{t('registerSubtitle')}</Text>

<Inputlabel={t('fullName')}value={name}onChangeText={setName}/>
<PhoneInputlabel={t('phoneNumber')}onChangePhone={setPhone}/>
<Inputlabel={t('passwordOptional')}placeholder={t('passwordHint')}value={password}onChangeText={setPassword}secureTextEntry/>

<Buttontitle={t('register')}onPress={handleRegister}loading={loading}style={styles.btn}/>
<Buttontitle={t('alreadyHaveAccount')+''+t('signIn')}onPress={()=>navigation.navigate('Login')}variant="outline"/>
</ScrollView>
);
}

conststyles=StyleSheet.create({
container:{flexGrow:1,padding:spacing.lg,backgroundColor:colors.background,justifyContent:'center'},
topRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:spacing.md},
logo:{fontSize:fontSize.xl,fontWeight:'700',color:colors.primary},
title:{fontSize:fontSize.xxl,fontWeight:'700',color:colors.text,marginBottom:spacing.xs},
subtitle:{fontSize:fontSize.md,color:colors.subtext,marginBottom:spacing.xl},
btn:{marginBottom:spacing.md},
});
