import { useState } from 'react';
import { CharacterEquipment, EquipmentSlotType, EquipmentItem } from '@/lib/inventory/types';
import { EquipmentTypeCard, equipmentCategories, EquipmentCategory } from './EquipmentTypeCard';
import { GearTypePopup } from './GearTypePopup';

interface EquipmentTypeGridProps {
  equipment: CharacterEquipment;
  onEquipItem: (slotType: EquipmentSlotType, item: EquipmentItem) => void;
  onUnequipItem: (slotType: EquipmentSlotType) => void;
  onItemInfo: (item: EquipmentItem, slotType: EquipmentSlotType) => void;
}

export function EquipmentTypeGrid({
  equipment,
  onEquipItem,
  onUnequipItem,
  onItemInfo,
}: EquipmentTypeGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<EquipmentCategory | null>(null);

  const handleCategoryClick = (category: EquipmentCategory) => {
    setSelectedCategory(category);
  };

  const handleClosePopup = () => {
    setSelectedCategory(null);
  };

  // Get the category definition for the popup
  const selectedCategoryDef = equipmentCategories.find(c => c.category === selectedCategory);

  return (
    <>
      {/* 3x3 Grid of Equipment Type Cards */}
      <div className="grid grid-cols-3 gap-3 p-3">
        {equipmentCategories.map((cat) => {
          // Get equipped items for this category
          const equippedItems = cat.slotTypes.map(slot => equipment.slots[slot]);
          
          return (
            <EquipmentTypeCard
              key={cat.category}
              category={cat.category}
              label={cat.label}
              icon={cat.icon}
              equippedItems={equippedItems}
              onClick={() => handleCategoryClick(cat.category)}
              className="aspect-square"
            />
          );
        })}
      </div>

      {/* Gear Type Popup */}
      {selectedCategory && selectedCategoryDef && (
        <GearTypePopup
          isOpen={!!selectedCategory}
          onClose={handleClosePopup}
          category={selectedCategoryDef}
          equipment={equipment}
          onEquipItem={onEquipItem}
          onUnequipItem={onUnequipItem}
          onItemInfo={onItemInfo}
        />
      )}
    </>
  );
}
