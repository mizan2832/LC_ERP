// Profile adapter for the application's local/demo session; not an authentication service.
// Login integration should store {id, name, mobile} under this key at sign-in.
const LoginProfile={
 key:'lc-login-profile-v1',
 current(){
  const raw=sessionStorage.getItem(this.key)??localStorage.getItem(this.key);
  if(raw===null)return {id:'DEMO-001',name:'Rahim Ahmed',mobile:''};
  let profile;try{profile=JSON.parse(raw)}catch{throw Error('Login profile is invalid. Sign in again.')}
  const id=String(profile?.id??profile?.userId??'').trim(),name=String(profile?.name??profile?.fullName??'').trim(),mobile=String(profile?.mobile??profile?.mobileNumber??'').trim();
  if(!id||!name)throw Error('Login profile is incomplete. Sign in again.');
  return {id,name,mobile};
 }
};
