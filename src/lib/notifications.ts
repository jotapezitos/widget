import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  deleteField,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Appointment, AppNotification, Barber, NotificationType } from '../types';
import { sendEmailNotification, MASTER_ADMIN_EMAIL } from './emailService';

async function resolveRecipientEmailAndName(
  notification: Omit<AppNotification, 'id' | 'read' | 'createdAt'>
): Promise<{ email: string; name: string }> {
  // 1. Explicit email specified in notification
  if (notification.recipientEmail && notification.recipientEmail.includes('@')) {
    return {
      email: notification.recipientEmail,
      name: notification.recipientName || 'Usuário',
    };
  }

  // 2. Target is Barber (e.g. barberId provided)
  if (notification.barberId) {
    try {
      const barberDoc = await getDoc(doc(db, 'barbers', notification.barberId));
      if (barberDoc.exists()) {
        const bData = barberDoc.data() as Barber;
        const bEmail = bData.googleEmail || bData.email;
        if (bEmail && bEmail.includes('@')) {
          return { email: bEmail, name: bData.name || 'Barbeiro' };
        }
      }

      const userSnap = await getDocs(
        query(collection(db, 'users'), where('barberId', '==', notification.barberId))
      );
      if (!userSnap.empty) {
        const uData = userSnap.docs[0].data();
        if (uData.email && uData.email.includes('@')) {
          return { email: uData.email, name: uData.name || 'Barbeiro' };
        }
      }
    } catch (err) {
      console.error('Error resolving barber email:', err);
    }
  }

  // 3. Target is Client (appointmentId or userId or clientId)
  if (notification.appointmentId) {
    try {
      const aptDoc = await getDoc(doc(db, 'appointments', notification.appointmentId));
      if (aptDoc.exists()) {
        const aptData = aptDoc.data() as Appointment;
        if (aptData.clientEmail && aptData.clientEmail.includes('@')) {
          return { email: aptData.clientEmail, name: aptData.clientName || 'Cliente' };
        }
      }
    } catch (err) {
      console.error('Error resolving appointment client email:', err);
    }
  }

  const clientId = notification.userId || notification.clientId;
  if (clientId) {
    try {
      const userDoc = await getDoc(doc(db, 'users', clientId));
      if (userDoc.exists()) {
        const uData = userDoc.data();
        if (uData.email && uData.email.includes('@')) {
          return { email: uData.email, name: uData.name || 'Cliente' };
        }
      }
    } catch (err) {
      console.error('Error resolving user email:', err);
    }
  }

  // 4. Target is Super Admin or Staff/Owner without specific barber
  if (notification.targetRole === 'super_admin') {
    try {
      const superAdminSnap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'super_admin'))
      );
      if (!superAdminSnap.empty) {
        const saData = superAdminSnap.docs[0].data();
        if (saData.email && saData.email.includes('@')) {
          return { email: saData.email, name: saData.name || 'Administrador Master' };
        }
      }
    } catch (err) {
      console.error('Error resolving super admin email:', err);
    }
    return { email: MASTER_ADMIN_EMAIL, name: 'Administrador Master' };
  }

  if (notification.targetRole === 'staff_or_owner') {
    try {
      const ownerSnap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'tenant_owner'))
      );
      if (!ownerSnap.empty) {
        const oData = ownerSnap.docs[0].data();
        if (oData.email && oData.email.includes('@')) {
          return { email: oData.email, name: oData.name || 'Gestor da Barbearia' };
        }
      }
    } catch (err) {
      console.error('Error resolving owner email:', err);
    }
  }

  // Fallback to active auth email if available
  try {
    const authUser = (await import('./firebase')).auth.currentUser;
    if (authUser && authUser.email && authUser.email.includes('@')) {
      return { email: authUser.email, name: authUser.displayName || 'Usuário' };
    }
  } catch (err) {
    console.error('Error getting auth current user:', err);
  }

  return { email: MASTER_ADMIN_EMAIL, name: 'Gestor da Barbearia' };
}

export const sendNotification = async (
  notification: Omit<AppNotification, 'id' | 'read' | 'createdAt'>
) => {
  try {
    const recipient = await resolveRecipientEmailAndName(notification);

    await addDoc(collection(db, 'notifications'), {
      ...notification,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      read: false,
      createdAt: new Date().toISOString(),
    });

    const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://barber.app';
    const actionUrl = notification.actionUrl || `${appOrigin}/?notification=${encodeURIComponent(notification.title)}`;

    sendEmailNotification({
      toEmail: recipient.email,
      toName: recipient.name,
      subject: `[Notificação Barba & Estilo] ${notification.title}`,
      title: notification.title,
      bodyText: notification.message,
      actionUrl,
      actionText: 'Acessar o Sistema',
      category: 'notification',
      relatedId: notification.appointmentId,
    }).catch((err) => console.error('Error dispatching notification email:', err));

  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'notifications');
  }
};

export const requestClientReschedule = async (
  appointment: Appointment,
  newDate: string,
  newTime: string
) => {
  try {
    await updateDoc(doc(db, 'appointments', appointment.id), {
      status: 'reschedule_requested',
      requestedDate: newDate,
      requestedTime: newTime,
    });

    const formattedDate = newDate.split('-').reverse().join('/');
    await sendNotification({
      targetRole: 'staff_or_owner',
      barberId: appointment.barberId,
      clientId: appointment.clientId,
      title: 'Solicitação de Remarcação 🔄',
      message: `${appointment.clientName} solicitou remarcar o atendimento de ${appointment.serviceName} para ${formattedDate} às ${newTime}h.`,
      type: 'reschedule_request',
      appointmentId: appointment.id,
      requestedDate: newDate,
      requestedTime: newTime,
      status: 'pending',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `appointments/${appointment.id}`);
  }
};

export const approveRescheduleRequest = async (
  appointment: Appointment,
  notificationId?: string
) => {
  try {
    const targetDate = appointment.requestedDate || appointment.date;
    const targetTime = appointment.requestedTime || appointment.time;

    await updateDoc(doc(db, 'appointments', appointment.id), {
      date: targetDate,
      time: targetTime,
      status: 'scheduled',
      requestedDate: deleteField(),
      requestedTime: deleteField(),
    });

    if (notificationId) {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
        status: 'approved',
      });
    }

    // Always update all matching pending notifications for this appointment
    const notifSnap = await getDocs(
      query(
        collection(db, 'notifications'),
        where('appointmentId', '==', appointment.id),
        where('type', '==', 'reschedule_request')
      )
    );
    for (const d of notifSnap.docs) {
      await updateDoc(doc(db, 'notifications', d.id), { read: true, status: 'approved' });
    }

    const formattedDate = targetDate.split('-').reverse().join('/');
    await sendNotification({
      userId: appointment.clientId,
      title: 'Remarcação Aprovada! 🎉',
      message: `Sua solicitação para o serviço ${appointment.serviceName} no dia ${formattedDate} às ${targetTime}h foi aprovada pela barbearia!`,
      type: 'reschedule_approved',
      appointmentId: appointment.id,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `appointments/${appointment.id}`);
  }
};

export const rejectRescheduleRequest = async (
  appointment: Appointment,
  notificationId?: string
) => {
  try {
    const attemptedDate = (appointment.requestedDate || '').split('-').reverse().join('/');
    const attemptedTime = appointment.requestedTime || '';

    await updateDoc(doc(db, 'appointments', appointment.id), {
      status: 'scheduled',
      requestedDate: deleteField(),
      requestedTime: deleteField(),
    });

    if (notificationId) {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
        status: 'rejected',
      });
    }

    // Always update all matching pending notifications for this appointment
    const notifSnap = await getDocs(
      query(
        collection(db, 'notifications'),
        where('appointmentId', '==', appointment.id),
        where('type', '==', 'reschedule_request')
      )
    );
    for (const d of notifSnap.docs) {
      await updateDoc(doc(db, 'notifications', d.id), { read: true, status: 'rejected' });
    }

    await sendNotification({
      userId: appointment.clientId,
      title: 'Remarcação Não Aprovada ⚠️',
      message: `Não foi possível aprovar a remarcação para ${attemptedDate} às ${attemptedTime}h. Seu horário original permanece agendado sem alterações.`,
      type: 'reschedule_rejected',
      appointmentId: appointment.id,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `appointments/${appointment.id}`);
  }
};

const creatingNotifLocks = new Set<string>();

export const notifyNewBooking = async (appointment: Appointment) => {
  const formattedDate = appointment.date.split('-').reverse().join('/');
  await sendNotification({
    targetRole: 'barber',
    barberId: appointment.barberId,
    title: 'Novo Agendamento ✂️',
    message: `${appointment.clientName} agendou ${appointment.serviceName} com ${appointment.barberName} para ${formattedDate} às ${appointment.time}h.`,
    type: 'booking',
    appointmentId: appointment.id,
  });
};

export const notifyStaffReschedule = async (
  appointment: Appointment,
  oldDate: string,
  oldTime: string,
  newDate: string,
  newTime: string
) => {
  const formattedNewDate = newDate.split('-').reverse().join('/');
  await sendNotification({
    userId: appointment.clientId,
    title: 'Horário Alterado pela Barbearia 📅',
    message: `A barbearia remarcou seu atendimento de ${appointment.serviceName} para ${formattedNewDate} às ${newTime}h.`,
    type: 'reschedule_by_staff',
    appointmentId: appointment.id,
  });
};

export const notifyCompletedService = async (appointment: Appointment) => {
  await sendNotification({
    userId: appointment.clientId,
    title: 'O que achou do seu visual? ⭐',
    message: `Obrigado pela preferência, ${appointment.clientName}! Avalie nosso atendimento no Google ou confira nossos trabalhos no Instagram!`,
    type: 'review_prompt',
    appointmentId: appointment.id,
    actionUrl: 'https://g.page/r/review',
  });
};

export const checkAutomaticNotifications = async (
  userId: string,
  userAppointments: Appointment[],
  existingNotifications: AppNotification[] = []
) => {
  if (!userId || userAppointments.length === 0) return;

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Check for upcoming appointment today (Reminder)
  const todayApts = userAppointments.filter(
    (a) => a.date === todayStr && a.status === 'scheduled'
  );

  for (const apt of todayApts) {
    const lockKey = `reminder_${userId}_${apt.id}_${todayStr}`;
    if (creatingNotifLocks.has(lockKey)) continue;

    // Check if reminder already exists in memory or Firestore
    const alreadyExistsInMemory = existingNotifications.some(
      (n) => n.userId === userId && n.type === 'reminder' && n.appointmentId === apt.id
    );

    if (!alreadyExistsInMemory) {
      creatingNotifLocks.add(lockKey);
      try {
        const existingReminders = await getDocs(
          query(
            collection(db, 'notifications'),
            where('userId', '==', userId),
            where('type', '==', 'reminder'),
            where('appointmentId', '==', apt.id)
          )
        );

        if (existingReminders.empty) {
          await sendNotification({
            userId,
            title: 'Lembrete de Horário Hoje! ⏰',
            message: `Lembrete: Seu agendamento de ${apt.serviceName} com ${apt.barberName} está marcado para hoje às ${apt.time}h!`,
            type: 'reminder',
            appointmentId: apt.id,
          });
        }
      } catch (err) {
        console.error('Error checking reminder:', err);
      }
    }
  }

  // 2. Retention Check (If client's last completed appointment was > 14 days ago and NO upcoming scheduled appointments)
  const hasUpcomingScheduled = userAppointments.some((a) => a.status === 'scheduled' && a.date >= todayStr);
  if (hasUpcomingScheduled) return;

  const completedApts = userAppointments
    .filter((a) => a.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date));

  if (completedApts.length > 0) {
    const lastApt = completedApts[0];
    const lastAptDate = new Date(lastApt.date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lastAptDate.getTime()) / (1000 * 3600 * 24));

    if (diffDays >= 14) {
      const lockKey = `retention_${userId}_${lastApt.id}`;
      if (creatingNotifLocks.has(lockKey)) return;

      const alreadyExistsInMemory = existingNotifications.some(
        (n) => n.userId === userId && n.type === 'retention'
      );

      if (!alreadyExistsInMemory) {
        creatingNotifLocks.add(lockKey);
        try {
          const existingRetention = await getDocs(
            query(
              collection(db, 'notifications'),
              where('userId', '==', userId),
              where('type', '==', 'retention')
            )
          );

          if (existingRetention.empty) {
            await sendNotification({
              userId,
              title: 'Hora do Tapa no Visual! ✂️🔥',
              message: `Faz mais de 2 semanas desde o seu último corte! Que tal agendar o seu próximo horário e manter a régua máxima?`,
              type: 'retention',
            });
          }
        } catch (err) {
          console.error('Error checking retention:', err);
        }
      }
    }
  }
};
