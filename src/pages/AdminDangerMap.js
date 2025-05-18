// src/pages/AdminDangerMapPage.js
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import styles from './AdminPage.module.css';
import { Link } from 'react-router-dom';

/* global naver */
const AdminDangerMapPage = () => {
  const mapRef = useRef(null);
  const [paths, setPaths] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedDangerLevel, setSelectedDangerLevel] = useState('전체');
  const [selectedUserType, setSelectedUserType] = useState('남성');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState('어린이');
  const [selectedPath, setSelectedPath] = useState(null);

  const handleResetFilters = () => {
    setSelectedUserType('남성');
    setSelectedAgeGroup('어린이');
    setSelectedCategory('전체');
    setSelectedDangerLevel('전체');
  };

  useEffect(() => {
    if (selectedUserType === '노인') {
      setSelectedAgeGroup('');
    } else if (selectedAgeGroup === '') {
      setSelectedAgeGroup('어린이');
    }
  }, [selectedUserType]);

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const res = await axios.get('http://localhost:3001/api/complaintsmap');
        const updatedPaths = [];

        for (const path of res.data) {
          if (!path.route_coords) {
            try {
              const registerRes = await axios.post('http://localhost:3001/api/router/register', {
                start_lat: path.start_lat,
                start_lng: path.start_lng,
                end_lat: path.end_lat,
                end_lng: path.end_lng,
              });

              if (registerRes.data.success) {
                updatedPaths.push({
                  ...path,
                  id: path.id,
                  created_at: path.created_at,
                  route_coords: JSON.stringify(registerRes.data.route_coords),
                });
              } else {
                console.warn('❌ 경로 등록 실패:', registerRes.data.message);
              }
            } catch (err) {
              console.error('❌ 경로 등록 에러:', err);
            }
          } else {
            updatedPaths.push(path);
          }
        }
        setPaths(updatedPaths);
      } catch (err) {
        console.error('❌ 경로 데이터 불러오기 실패:', err);
      }
    };

    fetchRoutes();
  }, []);

  useEffect(() => {
    if (!window.naver || !paths.length || !mapRef.current) return;

    const map = new naver.maps.Map(mapRef.current, {
      center: new naver.maps.LatLng(35.854, 128.486),
      zoom: 14,
    });

    const infoWindow = new naver.maps.InfoWindow();
    naver.maps.Event.addListener(map, 'click', () => {
      infoWindow.close();
      setSelectedPath(null);
    });

    const filteredPaths = paths.filter((p) => {
  const danger = (p.danger_level ?? '').trim();
  const catMatch =
    selectedCategory === '전체' ||
    (selectedCategory === '없음'
      ? !p.category || p.category.trim() === '' || p.category === '없음'
      : p.category === selectedCategory);

  const dangerMatch = selectedDangerLevel === '전체' || danger === selectedDangerLevel;
  const userTypeMatch = p.user_type === selectedUserType;
  const ageMatch = selectedUserType === '노인' ? true : selectedAgeGroup === '어린이' ? p.age <= 14 : p.age >= 15;

  return catMatch && dangerMatch && userTypeMatch && ageMatch;
});


    const MAX_DISTANCE_METERS = 30;

    function getDistance(coord1, coord2) {
      const R = 6371000;
      const toRad = (deg) => (deg * Math.PI) / 180;
      const [lng1, lat1] = coord1;
      const [lng2, lat2] = coord2;

      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);

      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    const pathIdToCount = new Map();

    for (let i = 0; i < filteredPaths.length; i++) {
      const pathA = filteredPaths[i];
      const coordsA = JSON.parse(pathA.route_coords);
      const idA = pathA.id;

      for (let j = i + 1; j < filteredPaths.length; j++) {
        const pathB = filteredPaths[j];
        const coordsB = JSON.parse(pathB.route_coords);
        const idB = pathB.id;

        outer: for (let m = 0; m < coordsA.length - 1; m++) {
          const a1 = coordsA[m];
          const a2 = coordsA[m + 1];
          for (let n = 0; n < coordsB.length - 1; n++) {
            const b1 = coordsB[n];
            const b2 = coordsB[n + 1];

            const dist = Math.min(
              getDistance(a1, b1),
              getDistance(a1, b2),
              getDistance(a2, b1),
              getDistance(a2, b2)
            );

            if (dist <= MAX_DISTANCE_METERS) {
              pathIdToCount.set(idA, (pathIdToCount.get(idA) || 0) + 1);
              pathIdToCount.set(idB, (pathIdToCount.get(idB) || 0) + 1);
              break outer;
            }
          }
        }
      }
    }

    const dangerPriority = { '낮음': 1, '중간': 2, '높음': 3 };
    const sortedPaths = [...filteredPaths].sort((a, b) => {
      const da = dangerPriority[a.danger_level?.trim()] || 0;
      const db = dangerPriority[b.danger_level?.trim()] || 0;
      return da - db;
    });

    for (const path of sortedPaths) {
      try {
        const coords = JSON.parse(path.route_coords);
        const count = pathIdToCount.get(path.id || JSON.stringify(path)) || 0;
        const latlngs = coords.map(([lng, lat]) => new naver.maps.LatLng(lat, lng));

        const level = (path.danger_level ?? '').trim();
        const baseColor =
          level === '높음'
            ? '#dc2626'
            : level === '중간'
            ? '#f59e0b'
            : level === '낮음'
            ? '#3b82f6'
            : '#999999';

        const polyline = new naver.maps.Polyline({
          path: latlngs,
          strokeColor: baseColor,
          strokeWeight: 4,
          strokeOpacity: 1,
          strokeStyle: 'solid',
          clickable: true,
          map: map,
        });

        naver.maps.Event.addListener(polyline, 'click', (e) => {
          if (infoWindow.getMap()) {
            infoWindow.close();
          }
          infoWindow.setContent(`
            <div style="padding:10px; font-size:14px; max-width:200px;">
              ⚠️ <strong>위험 사유</strong><br />
              ${path.reason || '내용 없음'}<br/>
              🧨 <strong>위험 등급:</strong> ${path.danger_level || '없음'}<br/>
              📌 <strong>중복 횟수:</strong> ${count}
            </div>
          `);
          infoWindow.open(map, e.coord);
          setSelectedPath(path);
        });
      } catch (e) {
        console.warn('⚠️ 경로 시각화 실패:', e);
      }
    }
  }, [paths, selectedCategory, selectedDangerLevel, selectedUserType, selectedAgeGroup]);

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours()}시 ${d.getMinutes()}분`;
  };

  return (
    <div className={styles['admin-wrapper']}>
      <div className={styles['admin-container']}>
        <div className={styles['admin-button-top-left']}>
          <Link to="/admin" className={styles['admin-link-button']}>
            ← 관리자 페이지로
          </Link>
        </div>

        <h1 className={styles['admin-title']} style={{ fontSize: '1.8rem' }}>
          🧭 위험 구간 지도 페이지
        </h1>

        <div style={{ display: 'flex', gap: '20px', margin: '10px 0 20px', alignItems: 'end' }}>
          <div>
            <label style={{ fontWeight: 600, marginRight: '10px' }}>유형</label>
            <select
              value={selectedUserType}
              onChange={(e) => setSelectedUserType(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '1rem' }}
            >
              {['남성', '여성', '노인'].map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontWeight: 600, marginRight: '10px' }}>연령</label>
            <select
              value={selectedAgeGroup}
              onChange={(e) => setSelectedAgeGroup(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '1rem' }}
              disabled={selectedUserType === '노인'}
            >
              {['어린이', '청년'].map((age) => (
                <option key={age} value={age}>{age}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontWeight: 600, marginRight: '10px' }}>카테고리</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '1rem' }}
            >
              {['전체', 'CCTV 부재', '가로등 부재', '좁은 길목', '보도블럭 파손', '노인 경사', '기타', '없음'].map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontWeight: 600, marginRight: '10px' }}>위험 등급</label>
            <select
              value={selectedDangerLevel}
              onChange={(e) => setSelectedDangerLevel(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '1rem' }}
            >
              {['전체', '낮음', '중간', '높음'].map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleResetFilters}
            style={{
              padding: '6px 14px',
              fontSize: '1rem',
              backgroundColor: '#f3f4f6',
              border: '1px solid #ccc',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            🔄 필터 초기화
          </button>
        </div>

        <div style={{ height: '500px', position: 'relative' }}>
          <h2 style={{ padding: '10px 0' }}>🚧 민원 기반 위험 경로 시각화</h2>
          <div
            ref={mapRef}
            style={{
              width: '100%',
              height: '100%',
              border: '1px solid #ccc',
              position: 'relative',
            }}
          >
            {selectedPath && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'white',
                borderTop: '1px solid #ccc',
                padding: '12px 20px',
                fontSize: '14px',
                boxShadow: '0 -2px 6px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                zIndex: 100,
              }}>
                <p style={{ margin: 0, fontWeight: 500, color: '#111827' }}>
                  {selectedPath.user_type} / {selectedAgeGroup} / {selectedPath.category || '없음'} / 위험점수: {selectedPath.danger_score !== undefined ? selectedPath.danger_score : '없음'} / 위험등급: {(selectedPath.danger_level ?? '').trim() || '없음'}
                </p>
                <p style={{ margin: 0, color: '#374151' }}>{selectedPath.reason || '내용 없음'}</p>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>{formatDate(selectedPath.created_at)}</p>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: '40px' }}>
          <h2 style={{ margin: '30px 0 10px 0' }}>📝 경로 기반 민원 내용</h2>
          <ul className={styles['admin-complaint-list']}>
            {paths
              .filter((p) => {
                const danger = (p.danger_level ?? '').trim();
                const catMatch =
                  selectedCategory === '전체' ||
                  (selectedCategory === '없음'
                    ? !p.category || p.category.trim() === '' || p.category === '없음'
                    : p.category === selectedCategory);

                const dangerMatch = selectedDangerLevel === '전체' || danger === selectedDangerLevel;
                const userTypeMatch = p.user_type === selectedUserType || selectedUserType === '노인';
                const ageMatch = selectedAgeGroup === '어린이' ? p.age <= 14 : p.age >= 15;
                return catMatch && dangerMatch && userTypeMatch && ageMatch;
              })
              .slice(0, 10)
              .map((item, idx) => (
                <li key={idx} className={styles['admin-complaint-item']}>
                  <p>
                    {item.user_type} / {selectedAgeGroup} / {item.category || '없음'} / 위험점수: {item.danger_score !== undefined ? item.danger_score : '없음'}
 / 위험등급: {(item.danger_level ?? '').trim() || '없음'}
                  </p>
                  <p>{item.reason || '내용 없음'}</p>
                  <p>{formatDate(item.created_at)}</p>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminDangerMapPage;
