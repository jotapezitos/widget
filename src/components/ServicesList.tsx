import React, { useEffect, useState } from 'react';
import { Scissors, Clock, Plus, Trash2, Edit2, Sparkles, CheckCircle2 } from 'lucide-react';
import { db, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, handleFirestoreError, OperationType } from '../lib/firebase';
import { Service } from '../types';
import { DEFAULT_SERVICES } from '../data/initialData';
import { useAuth } from '../context/AuthContext';

interface ServicesListProps {
  onSelectService: (service: Service) => void;
}

export const ServicesList: React.FC<ServicesListProps> = ({ onSelectService }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();

  // Admin form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    durationMinutes: 30,
    price: 35,
  });

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'services'),
      async (snapshot) => {
        if (snapshot.empty) {
          // Seed default services
          try {
            for (const item of DEFAULT_SERVICES) {
              await addDoc(collection(db, 'services'), item);
            }
          } catch (err) {
            console.error('Error seeding services:', err);
          }
        } else {
          const list: Service[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<Service, 'id'>),
          }));
          setServices(list);
        }
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'services');
      }
    );

    return () => unsub();
  }, []);

  const handleOpenAddModal = () => {
    setEditingService(null);
    setFormData({ name: '', description: '', durationMinutes: 30, price: 40 });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description,
      durationMinutes: service.durationMinutes,
      price: service.price,
    });
    setIsModalOpen(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.price <= 0) return;

    try {
      if (editingService) {
        const serviceRef = doc(db, 'services', editingService.id);
        await updateDoc(serviceRef, {
          name: formData.name,
          description: formData.description,
          durationMinutes: Number(formData.durationMinutes),
          price: Number(formData.price),
        });
      } else {
        await addDoc(collection(db, 'services'), {
          name: formData.name,
          description: formData.description,
          durationMinutes: Number(formData.durationMinutes),
          price: Number(formData.price),
          icon: 'Scissors',
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'services');
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'services', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `services/${id}`);
    }
  };

  return (
    <div id="services-section" className="py-12 bg-zinc-50 text-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4 border-b-2 border-zinc-200 pb-6">
          <div>
            <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1 rounded-lg bg-amber-400 text-black border-2 border-black text-xs font-black uppercase tracking-widest mb-2 font-bebas text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Scissors className="w-4 h-4 text-black" />
              MENU DE CORTES & SERVIÇOS EXCLUSIVOS
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bebas font-bold tracking-wide text-black uppercase flex flex-wrap items-center gap-2 leading-none">
              <span>ESCOLHA SEU</span>
              <span className="bg-amber-400 text-black px-2.5 py-0.5 rounded-lg border-2 border-black inline-block text-2xl sm:text-3xl md:text-4xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                SERVIÇO
              </span>
            </h2>
            <p className="text-zinc-600 mt-1 max-w-xl text-xs sm:text-sm font-medium">
              Cortes modernos, barba alinhada, platinado e risquinhos de precisão com garantia de acabamento impecável.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-2 self-start sm:self-auto font-bebas tracking-wide"
            >
              <Plus className="w-4 h-4" />
              Adicionar Serviço
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-40 sm:h-48 rounded-2xl bg-zinc-200 animate-pulse border-2 border-zinc-300" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-6">
            {services.map((service, idx) => (
              <div
                key={service.id}
                className="group relative bg-white rounded-2xl p-3 sm:p-6 border-2 border-black hover:border-black transition-all duration-300 flex flex-col justify-between shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] sm:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5"
              >
                <div>
                  <div className="flex items-start justify-between gap-1.5 sm:gap-4 mb-2 sm:mb-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
                      <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-amber-400 border-2 border-black flex items-center justify-center text-black font-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:rotate-6 transition-transform shrink-0">
                        <Scissors className="w-4 h-4 sm:w-6 sm:h-6" />
                      </div>
                      <span
                        className={`text-[8px] sm:text-[10px] font-black font-bebas tracking-wider uppercase px-1.5 sm:px-2 py-0.5 rounded border border-black ${
                          idx % 2 === 0 ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                        }`}
                      >
                        {idx % 2 === 0 ? 'EM ALTA' : 'POPULAR'}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm sm:text-3xl font-black font-bebas text-black tracking-wide bg-amber-300 px-1.5 sm:px-2.5 py-0.5 rounded border border-black inline-block">
                        R$ {service.price.toFixed(2)}
                      </span>
                      <div className="flex items-center justify-end gap-1 text-[10px] sm:text-xs text-zinc-600 mt-0.5 sm:mt-1 font-extrabold">
                        <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-900" />
                        <span>{service.durationMinutes} min</span>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-sm sm:text-2xl font-bebas font-bold text-black group-hover:text-amber-600 transition-colors uppercase tracking-wider line-clamp-1">
                    {service.name}
                  </h3>

                  {/* Description hidden on mobile as explicitly requested */}
                  <p className="hidden sm:block text-xs text-zinc-600 mt-2 line-clamp-3 leading-relaxed font-medium">
                    {service.description || 'Atendimento especial com lavagem e finalização profissional.'}
                  </p>
                </div>

                <div className="mt-3 sm:mt-6 pt-2 sm:pt-4 border-t-2 border-zinc-100 flex items-center justify-between gap-1.5">
                  <button
                    onClick={() => onSelectService(service)}
                    className="w-full py-1.5 sm:py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black border-2 border-black font-black transition-all flex items-center justify-center gap-1 sm:gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bebas uppercase tracking-wider text-xs sm:text-base"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black shrink-0" />
                    <span>
                      <span className="hidden sm:inline">Agendar Este Serviço</span>
                      <span className="sm:hidden">Agendar</span>
                    </span>
                  </button>

                  {isAdmin && (
                    <div className="hidden sm:flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEditModal(service)}
                        title="Editar"
                        className="p-1.5 text-zinc-700 hover:text-black hover:bg-zinc-100 rounded-lg transition-colors border border-zinc-300"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteService(service.id)}
                        title="Excluir"
                        className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Modal Add/Edit Service for Admin */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-2xl w-full max-w-md p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-zinc-900 relative">
            <h3 className="text-2xl font-bebas font-bold mb-4 text-black uppercase border-b-2 border-black pb-2">
              {editingService ? 'Editar Serviço' : 'Novo Serviço'}
            </h3>

            <form onSubmit={handleSaveService} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">Nome do Serviço</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Corte de Cabelo & Barba"
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase mb-1">Descrição</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detalhes do serviço..."
                  className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black uppercase mb-1">Preço (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black uppercase mb-1">Duração (Minutos)</label>
                  <input
                    type="number"
                    required
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
                    className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                  />
                </div>
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
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
