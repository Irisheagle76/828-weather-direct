export function initNotificationSettings(){
  for(const id of ['notifyAlerts','notifyPulse','saveNotifications','disableNotifications','testNotifications']){
    const element=document.getElementById(id);
    if(element)element.disabled=true;
  }
  document.getElementById('notificationStatus').textContent='Native app notifications are being connected. Browser notification preferences are managed separately.';
}
