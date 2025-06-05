import { useState } from 'react'
import './App.css'
import UserWise from './components/UserWise'
import MainCompetency from './components/MainCompetency'
import SubCompetency from './components/SubCompetency'
import UserSubCompetency from './components/UserSubCompetency'

function App() {
  const [activeItem, setActiveItem] = useState('user-wise');

  const menuItems = [
    { id: 'user-wise', label: 'User Wise Main Competency' },
    { id: 'user-sub-competency', label: 'User Wise Sub Competency' },
    { id: 'main-competency', label: 'Unit Wise Main Competency' },
    { id: 'sub-competency', label: 'Unit Wise Sub Competency' }
  ];

  const renderContent = () => {
    switch (activeItem) {
      case 'user-wise':
        return <UserWise />;
      case 'main-competency':
        return <MainCompetency />;
      case 'user-sub-competency':
        return <SubCompetency />;              
      case 'sub-competency':
        return <UserSubCompetency />;
      default:
        return <div className="content-section">Select a tab to view content</div>;
    }
  };

  return (
    <div className="dashboard">
      <div className="sidebar">
        <h2><img id="logo" src="/BLL_Logo.png" alt="Bodhi Learning Labs Logo" style={{ maxWidth: '150px', height: 'auto' }} /></h2>
        <ul>
          {menuItems.map((item) => (
            <li
              key={item.id}
              className={activeItem === item.id ? 'active' : ''}
              onClick={() => setActiveItem(item.id)}
            >
              {item.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="main-content">
        <div className="content-header">
          <h1>{menuItems.find(item => item.id === activeItem)?.label}</h1>
        </div>
        {renderContent()}
      </div>
    </div>
  )
}

export default App
