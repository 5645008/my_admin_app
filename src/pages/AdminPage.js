// src/pages/AdminPage.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend } from 'chart.js';
import axios from 'axios';
import styles from './AdminPage.module.css'; // ✅ 수정된 모듈 스타일
import AdminDangerMap from './AdminDangerMap';

ChartJS.register(BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend);

const AdminPage = () => {
  const [complaints, setComplaints] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedRegion, setSelectedRegion] = useState('전체');
  const [selectedDanger, setSelectedDanger] = useState('전체');
  const [hoveredRegion, setHoveredRegion] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [closeTimeout, setCloseTimeout] = useState(null);

  const [categoryData, setCategoryData] = useState({ labels: [], datasets: [] });
  const [keywordData, setKeywordData] = useState({ labels: [], datasets: [] });

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.parsed}건`
        }
      },
      legend: { position: 'bottom' }
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } }
    }
  };

  const regions = {
    '전체': [],
    '중구': [],
    '동구': [],
    '서구': [],
    '남구': [],
    '북구': [],
    '수성구': [],
    '달서구': ['호산로', '호산동로', '달구벌대로', '달서대로', '선원로', '계대동문로', '성서대로', '서당로', '신당로'],
    '달성군': []
  };

  useEffect(() => {
    axios.get('http://15.164.94.96:3001/api/complaints')
      .then(res => {
        setComplaints(res.data);
        setFiltered(res.data);
        generateCharts(res.data);
      })
      .catch(err => console.error('민원 데이터를 불러오지 못했습니다:', err));
  }, []);

  useEffect(() => {
    const result = complaints.filter(c => {
      const matchesSearch =
        c.title.includes(searchTerm) ||
        c.content.includes(searchTerm) ||
        c.category.includes(searchTerm) ||
        (Array.isArray(c.keywords) && c.keywords.some(([kw]) => kw.includes(searchTerm))) ||
        (typeof c.keywords === 'string' && c.keywords.includes(searchTerm));
      const matchesCategory = selectedCategory === '전체' || c.category === selectedCategory;
      const matchesRegion = selectedRegion === '전체' || (c.location && c.location.includes(selectedRegion));
      const matchesDanger = selectedDanger === '전체' || (selectedDanger === '위험' ? c.is_danger === 1 : c.is_danger !== 1);
      return matchesSearch && matchesCategory && matchesRegion && matchesDanger;
    });
    setFiltered(result);
    generateCharts(result);
  }, [searchTerm, selectedCategory, selectedRegion, selectedDanger, complaints]);

  const generateCharts = (data) => {
    const categoryCount = {};
    const keywordCount = {};

    data.forEach(item => {
      categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;

      let keywords = [];
      try {
        const raw = String(item.keywords || '[]');
        if (raw.trim().startsWith('[')) {
          keywords = JSON.parse(raw);
        } else {
          const parts = raw.split(',');
          for (let i = 0; i < parts.length - 1; i += 2) {
            keywords.push([parts[i], parseInt(parts[i + 1])]);
          }
        }
      } catch (e) {
        console.warn('키워드 파싱 실패:', e);
      }

      keywords.forEach(([kw]) => {
        keywordCount[kw] = (keywordCount[kw] || 0) + 1;
      });
    });

    setCategoryData({
      labels: Object.keys(categoryCount),
      datasets: [{
        label: '카테고리별 민원 수',
        data: Object.values(categoryCount),
        backgroundColor: ['#4f46e5', '#06b6d4', '#facc15', '#f472b6', '#10b981', '#f97316']
      }]
    });

    setKeywordData({
      labels: Object.keys(keywordCount).slice(0, 10),
      datasets: [{
        label: '상위 키워드',
        data: Object.values(keywordCount).slice(0, 10),
        backgroundColor: ['#60a5fa', '#f87171', '#34d399', '#fbbf24', '#a78bfa', '#f472b6', '#2dd4bf', '#818cf8', '#facc15', '#fb923c']
      }]
    });
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours()}시 ${d.getMinutes()}분`;
  };

  return (
    <div className={styles['admin-wrapper']}>
      <div className={styles['admin-container']}>
        <h1 className={styles['admin-title']}>📊 관리자 페이지</h1>

        <div className={styles['admin-filter-bar']}>
          <div className={styles['admin-filter-group']}>
            <label>카테고리</label>
            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
              {['전체', '엘리베이터', '계단', '도로', '조명', '난간', '기타'].map(opt => <option key={opt}>{opt}</option>)}
            </select>
          </div>

          <div className={`${styles['admin-filter-group']} ${styles['admin-custom-dropdown']}`}>
            <label>지역</label>
            <div
              className={styles['admin-dropdown-wrapper']}
              onMouseEnter={() => {
                if (closeTimeout) {
                  clearTimeout(closeTimeout);
                  setCloseTimeout(null);
                }
              }}
              onMouseLeave={() => {
                const timeout = setTimeout(() => {
                  setHoveredRegion(null);
                  setDropdownOpen(false);
                }, 1000);
                setCloseTimeout(timeout);
              }}
            >
              <div className={styles['admin-dropdown-toggle']} onClick={() => setDropdownOpen(!dropdownOpen)}>
                {selectedRegion}
              </div>

              {dropdownOpen && (
                <div className={styles['admin-dropdown-menu']}>
                  {Object.keys(regions).map(region => (
                    <div
                      key={region}
                      className={styles['admin-dropdown-item']}
                      onMouseEnter={() => setHoveredRegion(region)}
                      onClick={() => {
                        if (region !== '달서구') {
                          setSelectedRegion(region);
                          setDropdownOpen(false);
                        }
                      }}
                    >
                      {region}
                      {hoveredRegion === '달서구' && region === '달서구' && (
                        <div className={styles['admin-sub-dropdown']}>
                          {regions['달서구'].map(sub => (
                            <div
                              key={sub}
                              className={styles['admin-sub-dropdown-item']}
                              onClick={() => {
                                setSelectedRegion(sub);
                                setDropdownOpen(false);
                              }}
                            >
                              {sub}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={styles['admin-filter-group']}>
            <label>위험도</label>
            <select value={selectedDanger} onChange={e => setSelectedDanger(e.target.value)}>
              {['전체', '위험', '안전'].map(opt => <option key={opt}>{opt}</option>)}
            </select>
          </div>
        </div>

        <div className={styles['admin-chart-grid']}>
          <div className={styles['admin-chart-card']}>
            <h2 className={styles['admin-chart-title']}>카테고리 차트</h2>
            <Bar data={categoryData} options={chartOptions} />
          </div>
          <div className={styles['admin-chart-card']}>
            <h2 className={styles['admin-chart-title']}>키워드 차트</h2>
            <Pie data={keywordData} options={chartOptions} />
          </div>
        </div>

        <div className={styles['admin-search-section']}>
          <h2 className={styles['admin-search-title']}>🔍 민원 검색</h2>
          <input
            type="text"
            className={styles['admin-search-input']}
            placeholder="제목, 내용, 유형, 키워드 검색..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <ul className={styles['admin-complaint-list']}>
            {filtered.slice(0, 10).map(c => (
              <li key={c.id} className={styles['admin-complaint-item']}>
                <p className={styles['admin-complaint-title']}>{c.title}</p>
                <p className={styles['admin-complaint-meta']}>{c.category} | {formatDate(c.created_at)}</p>
                <p className={styles['admin-complaint-content']}>{c.content}</p>
                {c.is_danger === 1 && <p className={styles['admin-complaint-danger']}>⚠️ 위험 민원</p>}
              </li>
            ))}
          </ul>
        </div>
        <div className={styles['admin-button-container']}>
          <Link to="/admin/danger-map" className={styles['admin-link-button']}>
            🗺️ 위험 지도 보기
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
