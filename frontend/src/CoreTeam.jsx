import React from 'react';
import './index.css'; // CSS dosyamızı bağlıyoruz

const teamMembers = [
  { name: 'Aleyna', role: 'Frontend', borderColor: 'border-blue' },
  { name: 'Furkan', role: 'Frontend', borderColor: 'border-red' },
  { name: 'Poyraz', role: 'Frontend', borderColor: 'border-yellow' },
  { name: 'Yusuf Enes', role: 'Backend', borderColor: 'border-green' },
  { name: 'Amanda', role: 'Backend', borderColor: 'border-blue' },
  { name: 'Yunus', role: 'Backend', borderColor: 'border-red' },
];

export default function CoreTeam() {
  return (
    <div className="team-container">
      <h1 className="team-title">
        GDG On Campus <span>PAÜ</span>
      </h1>
      
      <div className="grid-container">
        {teamMembers.map((member, index) => (
          <div key={index} className={`member-card ${member.borderColor}`}>
            <h2 className="member-name">{member.name}</h2>
            <p className="member-role">&lt;{member.role} /&gt;</p>
          </div>
        ))}
      </div>
    </div>
  );
}