import { useState, useEffect } from 'react';
import { BehavioralProfile } from '@/components/BehavioralProfile';
import { StudyPlan } from '@/components/StudyPlanForm';

export interface SavedPlan {
  id: string;
  title: string;
  behavioralProfile: BehavioralProfile;
  studyPlan: StudyPlan;
  createdAt: number;
  columns?: any;
}

const STORAGE_KEY = 'saved-study-plans';

export const useSavedPlans = () => {
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);

  // Load plans from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSavedPlans(JSON.parse(stored));
      } catch (error) {
        console.error('Error loading saved plans:', error);
      }
    }
  }, []);

  const savePlan = (behavioralProfile: BehavioralProfile, studyPlan: StudyPlan, columns?: any) => {
    const newPlan: SavedPlan = {
      id: Date.now().toString(),
      title: studyPlan.tema_estudo,
      behavioralProfile,
      studyPlan,
      createdAt: Date.now(),
      columns,
    };

    const updatedPlans = [newPlan, ...savedPlans];
    setSavedPlans(updatedPlans);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPlans));
    return newPlan;
  };

  const deletePlan = (planId: string) => {
    const updatedPlans = savedPlans.filter(plan => plan.id !== planId);
    setSavedPlans(updatedPlans);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPlans));
  };

  const updatePlanColumns = (planId: string, columns: any) => {
    const updatedPlans = savedPlans.map(plan =>
      plan.id === planId ? { ...plan, columns } : plan
    );
    setSavedPlans(updatedPlans);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPlans));
  };

  return {
    savedPlans,
    savePlan,
    deletePlan,
    updatePlanColumns,
  };
};
