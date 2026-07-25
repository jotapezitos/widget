import React, { useEffect, useState } from 'react';
import { Users, Phone, Star, Plus, Edit2, Trash2, CalendarCheck, ShieldAlert } from 'lucide-react';
import { db, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, handleFirestoreError, OperationType } from '../lib/firebase';
import { Barber } from '../types';
import { DEFAULT_BARBERS } from '../data/initialData';
import { useAuth } from '../context/AuthContext';

interface BarbersListProps {
  onSelectBarber: (barber: Barber) => void;
}

export const BarbersList: React.FC<BarbersListProps> = ({ onSelectBarber }) => {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    specialty: '',
    bio: '',
    photoUrl: '',
    phone: '',
    active: true,
  });

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'barbers'),
      async (snapshot) => {
        const hasBeenSeeded = localStorage.getItem('barbaestilo_barbers_seeded_v5');
        if (snapshot.empty && !hasBeenSeeded) {
          localStorage.setItem('barbaestilo_barbers_seeded_v5', 'true');
          try {
            for (const item of DEFAULT_BARBERS) {
              await addDoc(collection(db, 'barbers'), item);
            }
          } catch (err) {
            console.error('Error seeding barbers:', err);
          }
        } else {
          const list: Barber[] = snapshot.docs.map((doc) => {
            const data = doc.data() as Omit<Barber, 'id'>;
            let normalizedName = data.name;
            let photoUrl = data.photoUrl;

            if (data.name.includes('Eduardo Silva') || data.name.includes('J.') || data.name.includes('Kauan')) {
              normalizedName = 'Kauan Lima';
              if (!photoUrl || photoUrl.includes('unsplash')) {
                photoUrl = DEFAULT_BARBERS[0].photoUrl;
              }
            } else if (data.name.includes('Carlos') || data.name.includes('Mestre') || data.name.includes('Eduardo')) {
              normalizedName = 'Eduardo Péricles';
              if (!photoUrl || photoUrl.includes('unsplash')) {
                photoUrl = DEFAULT_BARBERS[1].photoUrl;
              }
            } else if (data.name.includes('Rafael') || data.name.includes('Lucas')) {
              normalizedName = 'Lucas Andrade';
              if (!photoUrl || photoUrl.includes('unsplash')) {
                photoUrl = DEFAULT_BARBERS[2].photoUrl;
              }
            }

            return {
              id: doc.id,
              ...data,
              name: normalizedName,
              photoUrl: photoUrl || DEFAULT_BARBERS[0].photoUrl,
            };
          });
          setBarbers(list);
        }
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'barbers');
      }
    );

    return () => unsub();
  }, []);

  const handleOpenAddModal = () => {
    setEditingBarber(null);
    setFormData({
      name: '',
      specialty: 'Cortes & Barba',
      bio: '',
      photoUrl: DEFAULT_BARBERS[0].photoUrl,
      phone: '(11) 98888-7777',
      active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (barber: Barber) => {
    setEditingBarber(barber);
    setFormData({
      name: barber.name,
      specialty: barber.specialty,
      bio: barber.bio,
      photoUrl: barber.photoUrl,
      phone: barber.phone,
      active: barber.active,
    });
    setIsModalOpen(true);
  };

  const handleSaveBarber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    try {
      if (editingBarber) {
        await updateDoc(doc(db, 'barbers', editingBarber.id), formData);
      } else {
        await addDoc(collection(db, 'barbers'), formData);
      }
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'barbers');
    }
  };

  const handleDeleteBarber = async (id: string) => {
    setBarbers((prev) => prev.filter((b) => b.id !== id));
    try {
      await deleteDoc(doc(db, 'barbers', id));
    } catch (error) {
      console.error('Error deleting barber:', error);
    }
  };

  return (
    <div className="py-12 bg-zinc-50 text-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4 border-b-2 border-zinc-200 pb-6">
          <div>
            <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1 rounded-lg bg-amber-400 text-black border-2 border-black text-xs font-black uppercase tracking-widest mb-2 font-bebas text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Users className="w-4 h-4 text-black" />
              BARBEIROS DE CONFIANÇA
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bebas font-bold tracking-wide text-black uppercase flex flex-wrap items-center gap-2 leading-none">
              <span>{barbers.length <= 1 ? 'CONHEÇA SEU' : 'ESCOLHA SEU'}</span>
              <span className="bg-amber-400 text-black px-2.5 py-0.5 rounded-lg border-2 border-black inline-block text-2xl sm:text-3xl md:text-4xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                BARBEIRO
              </span>
            </h2>
            <p className="text-zinc-600 mt-1 max-w-xl text-xs sm:text-sm font-medium">
              Especialistas credenciados em cortes modernos, platinado, pigmentação e visagismo.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-2 font-bebas tracking-wide"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Barbeiro
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-64 rounded-2xl bg-zinc-200 animate-pulse border-2 border-zinc-300" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {barbers.map((barber) => (
              <div
                key={barber.id}
                className="group bg-white rounded-2xl overflow-hidden border-2 border-black transition-all duration-300 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between hover:translate-x-0.5 hover:translate-y-0.5"
              >
                <div>
                  <div className="relative h-64 overflow-hidden bg-zinc-100 border-b-2 border-black">
                    <img
                      src={barber.photoUrl}
                      alt={barber.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-4 left-4 px-3 py-1 rounded-lg bg-amber-400 text-black border-2 border-black text-xs font-black font-bebas uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      {barber.specialty}
                    </span>
                    <span className="absolute top-4 right-4 px-2.5 py-1 rounded-lg bg-black text-white border-2 border-black text-xs font-black font-bebas uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      ESPECIALISTA
                    </span>
                  </div>

                  <div className="p-6">
                    <h3 className="text-3xl font-bebas font-bold text-black uppercase tracking-wider group-hover:text-amber-600 transition-colors">
                      {barber.name}
                    </h3>
                    <p className="text-xs text-zinc-600 mt-2 leading-relaxed font-medium">
                      {barber.bio}
                    </p>
                  </div>
                </div>

                <div className="p-6 pt-0">
                  <button
                    onClick={() => onSelectBarber(barber)}
                    className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black border-2 border-black font-black text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2 font-bebas uppercase tracking-wider text-base"
                  >
                    <CalendarCheck className="w-4 h-4 text-black" />
                    Agendar Com {barber.name.split(' ')[0]}
                  </button>

                  {isAdmin && (
                    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t-2 border-zinc-100">
                      <button
                        onClick={() => handleOpenEditModal(barber)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-black text-xs font-bold border border-black flex items-center gap-1 font-bebas uppercase"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-black" /> Editar
                      </button>
                      <button
                        onClick={() => handleDeleteBarber(barber.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-300 flex items-center gap-1 font-bebas uppercase"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Excluir
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Admin Barber Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-2xl w-full max-w-md p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-zinc-900">
            <h3 className="text-2xl font-bebas font-bold mb-4 text-black uppercase border-b-2 border-black pb-2">
              {editingBarber ? 'Editar Barbeiro' : 'Cadastrar Barbeiro'}
            </h3>

            <form onSubmit={handleSaveBarber} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Carlos Eduardo (Mestre do Fade)"
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">Especialidade</label>
                <input
                  type="text"
                  required
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  placeholder="Ex: Fade, Degradê e Barboterapia"
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">Biografia / Resumo</label>
                <textarea
                  rows={2}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">URL da Foto</label>
                <input
                  type="text"
                  value={formData.photoUrl}
                  onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs text-black focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-200 text-black text-xs font-bold border border-black hover:bg-zinc-300 uppercase font-bebas text-base"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-400 text-black font-black border-2 border-black hover:bg-amber-300 uppercase font-bebas text-base shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  Salvar Barbeiro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
